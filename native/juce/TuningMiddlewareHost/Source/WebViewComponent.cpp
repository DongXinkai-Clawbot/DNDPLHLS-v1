#include "WebViewComponent.h"

WebViewComponent::WebViewComponent(RpcBridge& bridge)
    : rpcBridge(bridge)
{
    #if JUCE_WEB_BROWSER
    browser = std::make_unique<juce::WebBrowserComponent>(
        juce::WebBrowserComponent::Options()
            .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
            .withNativeIntegrationEnabled()
            .withResourceProvider([](const auto& url) -> std::optional<juce::WebBrowserComponent::Resource>
            {
                // Resource provider for embedded content
                return std::nullopt;
            })
    );
    
    addAndMakeVisible(*browser);

    // Set up event callback to send to WebView
    rpcBridge.setEventCallback([this](const juce::String& json)
    {
        if (browser)
        {
            // Send event to JavaScript
            juce::String script = "window.dispatchEvent(new CustomEvent('native-event', { detail: " + json + " }));";
            browser->evaluateJavascript(script, nullptr);
        }
    });

    // Load default content
    loadHTML(R"(
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Tuning Middleware Host</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #1a1a1a;
                    color: #fff;
                    margin: 0;
                    padding: 20px;
                }
                h1 { color: #4a9eff; }
                .status { color: #4ade80; }
            </style>
        </head>
        <body>
            <h1>Tuning Middleware Host</h1>
            <p class="status">Plugin loaded successfully</p>
            <p>WebView UI placeholder - React app will be embedded here.</p>
        </body>
        </html>
    )");
    #endif
}

WebViewComponent::~WebViewComponent()
{
}

void WebViewComponent::resized()
{
    #if JUCE_WEB_BROWSER
    if (browser)
        browser->setBounds(getLocalBounds());
    #endif
}

void WebViewComponent::loadURL(const juce::String& url)
{
    #if JUCE_WEB_BROWSER
    if (browser)
        browser->goToURL(url);
    #endif
    juce::ignoreUnused(url);
}

void WebViewComponent::loadHTML(const juce::String& html)
{
    #if JUCE_WEB_BROWSER
    if (browser)
    {
        // Create data URL from HTML
        auto base64 = juce::Base64::toBase64(html);
        browser->goToURL("data:text/html;base64," + base64);
    }
    #endif
    juce::ignoreUnused(html);
}

void WebViewComponent::handleJavaScriptMessage(const juce::String& message)
{
    // Handle RPC request from JavaScript
    auto response = rpcBridge.handleRequest(message);
    
    #if JUCE_WEB_BROWSER
    if (browser)
    {
        // Send response back to JavaScript
        juce::String script = "window.__nativeResponse && window.__nativeResponse(" + response + ");";
        browser->evaluateJavascript(script, nullptr);
    }
    #endif
}
