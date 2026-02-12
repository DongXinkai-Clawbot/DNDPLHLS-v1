#include "PluginProcessor.h"
#include "PluginEditor.h"

TuningMiddlewareHostProcessor::TuningMiddlewareHostProcessor()
    : AudioProcessor(BusesProperties()
        .withInput("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
}

TuningMiddlewareHostProcessor::~TuningMiddlewareHostProcessor()
{
}

const juce::String TuningMiddlewareHostProcessor::getName() const
{
    return JucePlugin_Name;
}

bool TuningMiddlewareHostProcessor::acceptsMidi() const { return true; }
bool TuningMiddlewareHostProcessor::producesMidi() const { return true; }
bool TuningMiddlewareHostProcessor::isMidiEffect() const { return true; }
double TuningMiddlewareHostProcessor::getTailLengthSeconds() const { return 0.0; }

int TuningMiddlewareHostProcessor::getNumPrograms() { return 1; }
int TuningMiddlewareHostProcessor::getCurrentProgram() { return 0; }
void TuningMiddlewareHostProcessor::setCurrentProgram(int) {}
const juce::String TuningMiddlewareHostProcessor::getProgramName(int) { return {}; }
void TuningMiddlewareHostProcessor::changeProgramName(int, const juce::String&) {}

void TuningMiddlewareHostProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused(sampleRate, samplesPerBlock);
}

void TuningMiddlewareHostProcessor::releaseResources()
{
}

bool TuningMiddlewareHostProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    juce::ignoreUnused(layouts);
    return true;
}

void TuningMiddlewareHostProcessor::processBlock(juce::AudioBuffer<float>& buffer, 
                                                  juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused(buffer);
    
    // Process MIDI through tuning engine
    tuningEngine.processBlock(midiMessages);
}

bool TuningMiddlewareHostProcessor::hasEditor() const { return true; }

juce::AudioProcessorEditor* TuningMiddlewareHostProcessor::createEditor()
{
    return new TuningMiddlewareHostEditor(*this);
}

void TuningMiddlewareHostProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    // Save tuning table and settings
    juce::MemoryOutputStream stream(destData, true);
    
    auto& table = tuningEngine.getTuningTable();
    for (int i = 0; i < 128; ++i)
        stream.writeFloat(table[i]);
    
    stream.writeFloat(tuningEngine.getPitchBendRange());
}

void TuningMiddlewareHostProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    juce::MemoryInputStream stream(data, static_cast<size_t>(sizeInBytes), false);
    
    std::array<float, 128> table;
    for (int i = 0; i < 128; ++i)
        table[i] = stream.readFloat();
    
    tuningEngine.setTuningTable(table);
    tuningEngine.setPitchBendRange(stream.readFloat());
}

void TuningMiddlewareHostProcessor::setTuningTable(const std::array<float, 128>& cents)
{
    tuningEngine.setTuningTable(cents);
}

void TuningMiddlewareHostProcessor::setPitchBendRange(float semitones)
{
    tuningEngine.setPitchBendRange(semitones);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new TuningMiddlewareHostProcessor();
}
