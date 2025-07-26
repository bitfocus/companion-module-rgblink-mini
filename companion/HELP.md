# RGBlink mini

This module was initially created for the _mini_ device. However, some actions have been tested with the _mini_, others with the _mini-edge SDI_. Some actions are also expected to work on the _mini+_, _mini-pro_, and other models. See the table below for specific details.

Devices must be controlled over a network — USB control is NOT supported.

## **Available Actions**

| Action | Description | Tested with ([* devices list](#tested-with))| Declarative API Compatibility ([** API Specifications](#api-list)) |
|--------|-------------|--------------------------|----------------------------------|
| Switch signal source | Similar to pressing the 1/2/3/4/5 source button on the device. 5th input is in BETA. | mini [(1)](#device-1) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| Switch mode (T-BAR/Auto) | Choose between T-BAR or Auto mode for switching. | mini [(1)](#device-1);<br/>mini-edge SDI [(2)](#device-2) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| Select source and target | Combines _Switch signal source_ and _Switch mode (T-BAR/Auto)_. May behave differently than expected. 5th input is in BETA. | mini [(1)](#device-1);<br/>mini-edge SDI [(2)](#device-2) | _See details above_ |
| EXPERIMENTAL: Performs a transition between Program and Preview | Performs a transition between Program and Preview (TAKE/CUT) | Not tested yet | Take mentioned in mini-pro [(2)](#api-mini-pro);<br/>Q Series:Q16pro Gen2 1U, FLEX Series:FLEXpro 16,FLEXpro 4 [(3)](#api-v106);<br/> mini-edge SDI (email) [(4)](#mail-20250726)|
| BETA: Switch signal source (PST or PGM) | Switch the selected signal to PST or PGM. Likely a better alternative to _Select source and target_, but untested on _mini_. | mini-edge SDI [(2)](#device-2) | mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) (Note: PST command is the same as _Switch signal source_, which is compatible with mini/mini-pro) |
| Set switch effect | Set a transition effect, such as cut or fade. See hardware manual or presets for more. | mini [(1)](#device-1) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| EXPERIMENTAL: Load scene/view to Preview (PVM) | Load saved earlier scene/view to Preview | Not tested yet | mini-pro [(2)](#api-mini-pro);<br/>mini-edge SDI (email) [(4)](#mail-20250726) |
| Select PIP mode | Select picture-in-picture mode (off, center, top, bottom, left, right, etc.). | mini [(1)](#device-1) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| Select PIP layer (A or B) | Select the PIP layer before setting the signal source. | mini [(1)](#device-1) | _Undocumented_ |
| Build PIP from selected sources | Set PIP mode, select two sources and output (Live or Preview). Combines _Select PIP mode_, _Select PIP layer (A or B)_, and _Switch signal source_. | mini [(1)](#device-1);<br/>NOT WORK with mini-edge SDI [(3)](#api-v106) | _See details above_ |
| BETA: Switch input signal channel (HDMI/SDI) | Select the input channel (HDMI or SDI) for numbered inputs, if supported by hardware. | mini-edge SDI [(2)](#device-2) | mini Series: mini-ISO, mini-edge SDI, mini-mx SDI [(3)](#api-v106) |
| EXPERIMENTAL: Set T-BAR position | Set the T-BAR position to MIN or MAX. | _Not tested yet_ | mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| BETA: Set AFV (Audio Follow Video) | Enable or disable AFV for selected input | mini-edge SDI [(2)](#device-2) | mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| EXPERIMENTAL:  Set LINE IN on/off | Turn on/off LINE IN | _Not tested yet_ | MSP Series: MSP 405 [(3)](#api-v106) |
| EXPERIMENTAL: Set mixing audio | Turn on/off audio from sources |  _Not tested yet_ | mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| EXPERIMENTAL: Set audio volume | Set audio volume for inputs and output |  _Not tested yet_ | mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| EXPERIMENTAL: Set LINE IN audio volume | Set volume for LINE IN |  _Not tested yet_ | mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |
| EXPERIMENTAL: Set MIC IN audio volume | Set volume for MIC IN |  _Not tested yet_ | mini Series: mini-pro, mini-pro v3, mini-ISO [(3)](#api-v106) |

### <a name="tested-with"></a>(*) Tested with devices

1. <a name="device-1"></a> mini, with firmware MCU VER 1.14, VIDEO VER 1.57  
2. <a name="device-2"></a> mini-edge SDI, with firmware 1.2.0

### <a name="api-list"></a>(**) API Specifications

1. <a name="api-mini"></a> mini API(EN)-20210225.pdf  
2. <a name="api-mini-pro"></a> RGBlink mini-pro OpenAPI_V1.2_20220208.pdf  
3. <a name="api-v106"></a> RGBlink API_V1.0.6_20250611.pdf
4. <a name="mail-20250726"></a> Email message 2025.07.26 (B.)

## **Available Feedbacks (Current State)**

There are a few feedbacks available, similar to actions. See presets for usage examples.

## **Release Notes**

### Changes in 2.1.0 (July 2025)

- Added actions and changes based on _RGBlink API_V1.0.6_20250611.pdf_, some of them tested with mini-edge SDI (firmware 1.2.0)
- Added extra polling commands for mini-edge SDI (disabled by default in connection settings)
- Added 5th input number (BETA — not all hardware includes this button)
- Added BETA action _Switch signal source (PST or PGM)_, intended as a better alternative to _Select source and target_
- Added BETA action _Switch input signal channel (HDMI/SDI)_ for devices with 4 HDMI and 4 SDI inputs
- Added EXPERIMENTAL action _Set T-BAR position_ (not yet tested)
- Added BETA action _Set AFV (Audio Follow Video)_
- Added EXPERIMENTAL action _Set LINE IN on/off_ (not yet tested)
- Added EXPERIMENTAL action _Set mixing audio_ (not yet tested)
- Added EXPERIMENTAL action _Set audio volume_ (not yet tested)
- Added EXPERIMENTAL action _Set LINE IN audio volume_ (not yet tested)
- Added EXPERIMENTAL action _Set MIC IN audio volume_ (not yet tested)
- Added EXPERIMENTAL action _Performs a transition between Program and Preview_ (Take/CUT) (not yet tested)
- Added EXPERIMENTAL action _Load scene/view to Preview (PVM)_ (not yet tested)
