#include "TuningEngine.h"

TuningEngine::TuningEngine()
{
    // Initialize tuning table to 12TET (0 cents deviation)
    tuningTable.fill(0.0f);
    
    // Initialize active notes
    for (auto& channel : activeNotes)
        for (auto& note : channel)
            note = ActiveNote{};
}

void TuningEngine::setTuningTable(const std::array<float, 128>& cents)
{
    tuningTable = cents;
}

void TuningEngine::setPitchBendRange(float semitones)
{
    pitchBendRange = juce::jlimit(1.0f, 96.0f, semitones);
}

int TuningEngine::calculatePitchBend(float cents) const
{
    if (pitchBendRange <= 0.0f)
        return 8192;

    // Range is +/- pitchBendRange semitones = +/- (pitchBendRange * 100) cents
    float rangeCents = pitchBendRange * 100.0f;
    float normalized = cents / rangeCents; // -1 to 1

    // Map to 0-16383 where 8192 is center
    int value = static_cast<int>(8192.0f + normalized * 8192.0f);
    return juce::jlimit(0, 16383, value);
}

void TuningEngine::processBlock(juce::MidiBuffer& midiMessages)
{
    juce::MidiBuffer processedMidi;

    for (const auto metadata : midiMessages)
    {
        auto message = metadata.getMessage();
        int samplePosition = metadata.samplePosition;
        int channel = message.getChannel() - 1; // 0-indexed

        if (channel < 0 || channel >= 16)
        {
            processedMidi.addEvent(message, samplePosition);
            continue;
        }

        if (message.isNoteOn())
        {
            int note = message.getNoteNumber();
            int velocity = message.getVelocity();

            // Get cents deviation for this note
            float cents = tuningTable[note];

            // Calculate pitch bend
            int pitchBend = calculatePitchBend(cents);

            // Store active note info
            activeNotes[channel][note] = { note, note, pitchBend };

            // Send pitch bend first
            auto pbMessage = juce::MidiMessage::pitchWheel(channel + 1, pitchBend);
            processedMidi.addEvent(pbMessage, samplePosition);

            // Then send note on
            auto noteOnMessage = juce::MidiMessage::noteOn(channel + 1, note, (juce::uint8)velocity);
            processedMidi.addEvent(noteOnMessage, samplePosition);
        }
        else if (message.isNoteOff())
        {
            int note = message.getNoteNumber();
            int velocity = message.getVelocity();

            // Get stored note info
            auto& activeNote = activeNotes[channel][note];

            if (activeNote.originalNote >= 0)
            {
                // Send note off
                auto noteOffMessage = juce::MidiMessage::noteOff(channel + 1, activeNote.outputNote, (juce::uint8)velocity);
                processedMidi.addEvent(noteOffMessage, samplePosition);

                // Clear active note
                activeNote = ActiveNote{};
            }
            else
            {
                // Pass through if we don't have record of this note
                processedMidi.addEvent(message, samplePosition);
            }
        }
        else
        {
            // Pass through all other messages
            processedMidi.addEvent(message, samplePosition);
        }
    }

    midiMessages.swapWith(processedMidi);
}

void TuningEngine::reset()
{
    for (auto& channel : activeNotes)
        for (auto& note : channel)
            note = ActiveNote{};
}
