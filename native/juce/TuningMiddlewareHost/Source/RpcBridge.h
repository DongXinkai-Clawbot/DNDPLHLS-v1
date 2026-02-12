#pragma once

#include <JuceHeader.h>

class TuningMiddlewareHostProcessor;

/**
 * RpcBridge - JSON-RPC bridge between WebView and native code
 */
class RpcBridge
{
public:
    explicit RpcBridge(TuningMiddlewareHostProcessor& processor);
    ~RpcBridge() = default;

    // Handle incoming JSON-RPC request from WebView
    juce::String handleRequest(const juce::String& jsonRequest);

    // Send event to WebView
    using EventCallback = std::function<void(const juce::String&)>;
    void setEventCallback(EventCallback callback) { eventCallback = callback; }
    void sendEvent(const juce::String& method, const juce::var& params);

private:
    TuningMiddlewareHostProcessor& processor;
    EventCallback eventCallback;

    // RPC method handlers
    juce::var handleSetTuning(const juce::var& params);
    juce::var handleSetPitchBendRange(const juce::var& params);
    juce::var handleGetState(const juce::var& params);

    // JSON helpers
    juce::String createResponse(int id, const juce::var& result);
    juce::String createErrorResponse(int id, int code, const juce::String& message);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(RpcBridge)
};
