# TuningMiddlewareHost - JUCE MIDI Effect Plugin
# Phase A: Basic MIDI Effect with WebView UI

cmake_minimum_required(VERSION 3.22)
project(TuningMiddlewareHost VERSION 1.0.0)

# JUCE is fetched via CPM or should be installed
find_package(JUCE CONFIG REQUIRED)

# Plugin Target
juce_add_plugin(TuningMiddlewareHost
    COMPANY_NAME "MicrotonalLattice"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT TRUE
    IS_MIDI_EFFECT TRUE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD TRUE
    PLUGIN_MANUFACTURER_CODE Mtlc
    PLUGIN_CODE Tmwh
    FORMATS AU VST3 Standalone
    PRODUCT_NAME "Tuning Middleware Host"
)

# Source Files
target_sources(TuningMiddlewareHost
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginProcessor.h
        Source/PluginEditor.cpp
        Source/PluginEditor.h
        Source/TuningEngine.cpp
        Source/TuningEngine.h
        Source/RpcBridge.cpp
        Source/RpcBridge.h
        Source/WebViewComponent.cpp
        Source/WebViewComponent.h
)

# Compile Definitions
target_compile_definitions(TuningMiddlewareHost
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

# Link Libraries
target_link_libraries(TuningMiddlewareHost
    PRIVATE
        juce::juce_audio_utils
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# Resources (WebApp)
juce_add_binary_data(TuningMiddlewareHostData
    SOURCES
        Resources/webapp/index.html
)

target_link_libraries(TuningMiddlewareHost PRIVATE TuningMiddlewareHostData)
