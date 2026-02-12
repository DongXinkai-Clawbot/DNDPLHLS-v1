#pragma once

#include <JuceHeader.h>
#include <array>

/**
 * TuningEngine - Core tuning logic for MIDI processing
 * 
 * Applies pitch bend to incoming MIDI notes based on a tuning table.
 * Each note can have a cents deviation from 12TET.
 */
class TuningEngine
{
public:
    TuningEngine();
    ~TuningEngine() = default;

    // Process MIDI buffer, applying tuning
    void processBlock(juce::MidiBuffer& midiMessages);

    // Set tuning table (128 entries, cents deviation per note)
    void setTuningTable(const std::array<float, 128>& cents);
    const std::array<float, 128>& getTuningTable() const { return tuningTable; }

    // Set pitch bend range in semitones
    void setPitchBendRange(float semitones);
    float getPitchBendRange() const { return pitchBendRange; }

    // Reset all active notes
    void reset();

private:
    // Calculate 14-bit pitch bend value for a given cents deviation
    int calculatePitchBend(float cents) const;

    // Tuning table: cents deviation for each MIDI note (0-127)
    std::array<float, 128> tuningTable;

    // Pitch bend range in semitones (must match target instrument)
    float pitchBendRange = 48.0f;

    // Track active notes per channel for proper note-off handling
    struct ActiveNote
    {
        int originalNote = -1;
        int outputNote = -1;
        int pitchBend = 8192;
    };
    
    std::array<std::array<ActiveNote, 128>, 16> activeNotes;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(TuningEngine)
};
