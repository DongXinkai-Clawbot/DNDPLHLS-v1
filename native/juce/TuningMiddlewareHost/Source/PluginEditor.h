#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "WebViewComponent.h"
#include "RpcBridge.h"

class TuningMiddlewareHostEditor : public juce::AudioProcessorEditor
{
public:
    explicit TuningMiddlewareHostEditor(TuningMiddlewareHostProcessor&);
    ~TuningMiddlewareHostEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    TuningMiddlewareHostProcessor& processorRef;
    
    std::unique_ptr<WebViewComponent> webView;
    std::unique_ptr<RpcBridge> rpcBridge;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(TuningMiddlewareHostEditor)
};
