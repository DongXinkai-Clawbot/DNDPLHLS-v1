/*
  ==============================================================================

    PluginProcessor.cpp
    Created: 9 Jan 2026
    Author:  Antigravity

  ==============================================================================
*/

#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
TuningMiddlewareAudioProcessor::TuningMiddlewareAudioProcessor()
#ifndef JucePlugin_PreferredChannelConfigurations
     : AudioProcessor (BusesProperties()
                     #if ! JucePlugin_IsMidiEffect
                      #if ! JucePlugin_IsSynth
                       .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      #endif
                       .withOutput ("Output", juce::AudioChannelSet::stereo(), true)
                     #endif
                       )
#endif
{
    formatManager.addDefaultFormats();
    
    // Initialize MTS-ESP Master (Try to acquire lock)
    // Only if NOT MIDI Effect
    #if ! JucePlugin_IsMidiEffect
        mtsEspMaster = std::make_unique<MtsEspMaster>();
        if (!mtsEspMaster->isActive()) {
            // Warn active
        }
    #endif
}

TuningMiddlewareAudioProcessor::~TuningMiddlewareAudioProcessor()
{
}

//==============================================================================
void TuningMiddlewareAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    juce::ValueTree root("ROOT");
    
    // Hosted Plugin
    if (hostedPlugin != nullptr) {
        juce::MemoryBlock pluginChunk;
        hostedPlugin->getStateInformation(pluginChunk);
        root.setProperty("hostedPluginData", pluginChunk.toBase64Encoding(), nullptr);
        root.setProperty("hostedPluginId", hostedPlugin->getPluginDescription().fileOrIdentifier, nullptr);
    }
    
    std::unique_ptr<juce::XmlElement> xml (root.createXml());
    copyXmlToBinary (*xml, destData);
}

void TuningMiddlewareAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState.get() != nullptr)
    {
         juce::ValueTree root = juce::ValueTree::fromXml(*xmlState);
         
         // Restore Plugin
         if (root.hasProperty("hostedPluginData")) {
             juce::String id = root.getProperty("hostedPluginId");
             juce::String base64 = root.getProperty("hostedPluginData");
             // Restoration logic...
         }
    }
}

//==============================================================================
// MTS-ESP Master Implementation
//==============================================================================

TuningMiddlewareAudioProcessor::MtsEspMaster::MtsEspMaster()
{
    // Named Mutex for unique master per session
    singleInstanceLock = std::make_unique<juce::InterprocessLock>("TUNING_MIDDLEWARE_MASTER_LOCK_UNIQUE");
    if (singleInstanceLock->enter()) {
        active = true;
    } else {
        active = false;
    }
}

TuningMiddlewareAudioProcessor::MtsEspMaster::~MtsEspMaster() {
    if (active) {
        // Deregister
    }
}

void TuningMiddlewareAudioProcessor::MtsEspMaster::setTuning(const double* freqs) {
    if (!active) return;
}

int TuningMiddlewareAudioProcessor::MtsEspMaster::getClientCount() {
    if (!active) return 0;
    return 1; 
}

//==============================================================================
void TuningMiddlewareAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    if (hostedPlugin != nullptr) {
        hostedPlugin->processBlock(buffer, midiMessages);
    }
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new TuningMiddlewareAudioProcessor();
}
