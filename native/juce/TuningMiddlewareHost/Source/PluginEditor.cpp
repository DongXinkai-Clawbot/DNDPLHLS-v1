#include "PluginProcessor.h"
#include "PluginEditor.h"

TuningMiddlewareHostEditor::TuningMiddlewareHostEditor(TuningMiddlewareHostProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Create RPC bridge
    rpcBridge = std::make_unique<RpcBridge>(processorRef);
    
    // Create WebView
    webView = std::make_unique<WebViewComponent>(*rpcBridge);
    addAndMakeVisible(*webView);

    // Set editor size
    setSize(800, 600);
    setResizable(true, true);
    setResizeLimits(400, 300, 1920, 1080);
}

TuningMiddlewareHostEditor::~TuningMiddlewareHostEditor()
{
}

void TuningMiddlewareHostEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a1a));
}

void TuningMiddlewareHostEditor::resized()
{
    if (webView)
        webView->setBounds(getLocalBounds());
}
