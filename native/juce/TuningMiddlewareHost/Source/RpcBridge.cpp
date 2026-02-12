#include "RpcBridge.h"
#include "PluginProcessor.h"

RpcBridge::RpcBridge(TuningMiddlewareHostProcessor& p)
    : processor(p)
{
}

juce::String RpcBridge::handleRequest(const juce::String& jsonRequest)
{
    auto json = juce::JSON::parse(jsonRequest);
    
    if (!json.isObject())
        return createErrorResponse(0, -32700, "Parse error");

    auto id = json.getProperty("id", 0);
    auto method = json.getProperty("method", "").toString();
    auto params = json.getProperty("params", juce::var());

    if (method.isEmpty())
        return createErrorResponse(id, -32600, "Invalid request: missing method");

    try
    {
        juce::var result;

        if (method == "midi.setTuning")
            result = handleSetTuning(params);
        else if (method == "midi.setPitchBendRange")
            result = handleSetPitchBendRange(params);
        else if (method == "getState")
            result = handleGetState(params);
        else
            return createErrorResponse(id, -32601, "Method not found: " + method);

        return createResponse(id, result);
    }
    catch (const std::exception& e)
    {
        return createErrorResponse(id, -32603, juce::String("Internal error: ") + e.what());
    }
}

juce::var RpcBridge::handleSetTuning(const juce::var& params)
{
    auto tuningArray = params.getProperty("tuningTable", juce::var());
    
    if (!tuningArray.isArray() || tuningArray.size() != 128)
        throw std::runtime_error("tuningTable must be an array of 128 values");

    std::array<float, 128> table;
    for (int i = 0; i < 128; ++i)
        table[i] = static_cast<float>(tuningArray[i]);

    processor.setTuningTable(table);
    return juce::var(true);
}

juce::var RpcBridge::handleSetPitchBendRange(const juce::var& params)
{
    auto range = static_cast<float>(params.getProperty("semitones", 48.0));
    processor.setPitchBendRange(range);
    return juce::var(true);
}

juce::var RpcBridge::handleGetState(const juce::var&)
{
    auto result = new juce::DynamicObject();
    
    result->setProperty("pitchBendRange", processor.getTuningEngine().getPitchBendRange());
    
    auto& table = processor.getTuningEngine().getTuningTable();
    juce::Array<juce::var> tuningArray;
    for (int i = 0; i < 128; ++i)
        tuningArray.add(table[i]);
    result->setProperty("tuningTable", tuningArray);

    return juce::var(result);
}

void RpcBridge::sendEvent(const juce::String& method, const juce::var& params)
{
    if (!eventCallback)
        return;

    auto event = new juce::DynamicObject();
    event->setProperty("jsonrpc", "2.0");
    event->setProperty("method", method);
    event->setProperty("params", params);

    eventCallback(juce::JSON::toString(juce::var(event)));
}

juce::String RpcBridge::createResponse(int id, const juce::var& result)
{
    auto response = new juce::DynamicObject();
    response->setProperty("jsonrpc", "2.0");
    response->setProperty("id", id);
    response->setProperty("result", result);
    return juce::JSON::toString(juce::var(response));
}

juce::String RpcBridge::createErrorResponse(int id, int code, const juce::String& message)
{
    auto error = new juce::DynamicObject();
    error->setProperty("code", code);
    error->setProperty("message", message);

    auto response = new juce::DynamicObject();
    response->setProperty("jsonrpc", "2.0");
    response->setProperty("id", id);
    response->setProperty("error", juce::var(error));
    return juce::JSON::toString(juce::var(response));
}
