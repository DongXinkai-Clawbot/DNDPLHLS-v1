#pragma once

#include <JuceHeader.h>
#include "RpcBridge.h"

/**
 * WebViewComponent - Embeds WebView for React UI
 */
class WebViewComponent : public juce::Component
{
public:
    explicit WebViewComponent(RpcBridge& bridge);
    ~WebViewComponent() override;

    void resized() override;

    // Load URL or HTML content
    void loadURL(const juce::String& url);
    void loadHTML(const juce::String& html);

private:
    RpcBridge& rpcBridge;
    
    #if JUCE_WEB_BROWSER
    std::unique_ptr<juce::WebBrowserComponent> browser;
    #endif

    // Handle messages from JavaScript
    void handleJavaScriptMessage(const juce::String& message);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WebViewComponent)
};
