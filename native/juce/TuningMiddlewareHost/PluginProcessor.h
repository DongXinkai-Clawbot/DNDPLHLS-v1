/*
  ==============================================================================

    PluginProcessor.h
    Created: 9 Jan 2026
    Author:  Antigravity

  ==============================================================================
*/

#pragma once

#include <JuceHeader.h>

class TuningMiddlewareAudioProcessor  : public juce::AudioProcessor,
                                        public juce::AudioProcessorValueTreeState::Listener
{
public:
    //==============================================================================
    TuningMiddlewareAudioProcessor();
    ~TuningMiddlewareAudioProcessor() override;

    //==============================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

   #ifndef JucePlugin_PreferredChannelConfigurations
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
   #endif

    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    //==============================================================================
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    //==============================================================================
    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    //==============================================================================
    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int index, const juce::String& newName) override;

    //==============================================================================
    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    //==============================================================================
    // Custom Methods
    void broadcastTuning(const juce::String& tuningDataJson);
    int getMtsEspClientCount() const;
    
    // Hosting
    void scanPlugins();
    void loadPlugin(const juce::String& pluginId);
    void openPluginWindow(const juce::String& pluginId);
    
    // Group Sync
    void sendGroupUpdate(const juce::String& groupId, const juce::String& payload);

private:
    //==============================================================================
    // MTS-ESP Master State
    class MtsEspMaster {
    public:
        MtsEspMaster();
        ~MtsEspMaster();
        void setTuning(const double* freqs); // Array of 128 frequencies
        int getClientCount();
        bool isActive() const { return active; }
    private:
        bool active = false;
        std::unique_ptr<juce::InterprocessLock> singleInstanceLock;
    };
    
    std::unique_ptr<MtsEspMaster> mtsEspMaster;
    
    // Plugin Hosting State
    juce::AudioPluginFormatManager formatManager;
    std::unique_ptr<juce::AudioPluginInstance> hostedPlugin;
    
    // State
    juce::ValueTree pluginState;
    
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (TuningMiddlewareAudioProcessor)
};
