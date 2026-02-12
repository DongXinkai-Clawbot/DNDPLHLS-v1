#pragma once

#include <JuceHeader.h>
#include "TuningEngine.h"

class TuningMiddlewareHostProcessor : public juce::AudioProcessor
{
public:
    TuningMiddlewareHostProcessor();
    ~TuningMiddlewareHostProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;

    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    // Tuning Engine Access
    TuningEngine& getTuningEngine() { return tuningEngine; }
    const TuningEngine& getTuningEngine() const { return tuningEngine; }

    // Set tuning table from UI
    void setTuningTable(const std::array<float, 128>& cents);
    void setPitchBendRange(float semitones);

private:
    TuningEngine tuningEngine;
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(TuningMiddlewareHostProcessor)
};
