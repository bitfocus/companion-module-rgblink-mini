# RGBlink mini

This module was initially created only for the _mini_. However, some actions was tested with _mini_, other with _mini-edge SDI_. Some actions should also works on _mini+_, _mini-pro_ and other. See details in table below.

Devices must be controlled over a network, USB control is NOT supported.

## **Available actions**

| Action    | Description     | Tested with [(* devices list)](#tested-with)  | Declarative API compatibility [(** api specifications)](#api-list) |
|---------------------------------|-----------------------------------------------------|-------------|--|
| Switch signal source | Similiar to pressing the 1/2/3/4/5 source button on the device. 5th input as BETA. | mini [(1)](#device-1) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series:mini-pro,mini-pro v3,mini-ISO [(3)](#api-v106)|
| Switch mode (T-BAR/Auto) | Choose T-BAR or Auto mode for switching. | mini [(1)](#device-1) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series:mini-pro,mini-pro v3,mini-ISO [(3)](#api-v106) |
| Select source and target | This is combination of _Switch signal source_ and _Switch mode (T-BAR/Auto)_ actions. It may work a little differently than you expect. 5th input as BETA. | mini [(1)](#device-1);<br> mini-edge SDI [(2)](#device-2) | _see details above_ |
| BETA: Switch signal source (PST or PGM) |  Switch selected signal to PST or PGM. This is probably better action than _Select source and target_. However, it's not tested with _mini_. | mini-edge SDI [(2)](#device-2) | mini Series:mini-pro,mini-pro v3,mini-ISO [(3)](#api-v106) (however PST command is same as _Switch signal source_, which is compabile with mini/mini-pro) |
| Switch effect | Transition effect, like cut, fade. See details in hardware manual or presets. | mini [(1)](#device-1) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series:mini-pro,mini-pro v3,mini-ISO [(3)](#api-v106) |
| Select PIP mode | Select picture-in-picture mode (off, center, top, bottom, left, right and others) |  mini [(1)](#device-1) | mini [(1)](#api-mini);<br/>mini-pro [(2)](#api-mini-pro);<br/>mini Series:mini-pro,mini-pro v3,mini-ISO [(3)](#api-v106) |
| Select PIP layer (A or B) | Select PIP layer before set signal source | mini [(1)](#device-1) | _undocummented_ |
| Build PIP from selected sources | Select PIP mode, two sources, and output (Live or Preview). This is combination of _Select PIP mode_, _Select PIP layer (A or B)_ and _Switch signal source_.  |  mini [(1)](#device-1) |  _see details above_ |
| BETA: Switch input signal channel (HDMI/SDI) | Select channel for numbered input, if hardware contains HDMI and SDI inputs | mini-edge SDI [(2)](#device-2) | MINI Series:mini-iso、mini-edge SDI、mini-mx SDI [(3)](#api-v106) |
| EXPERIMENTAL: Set T-BAR position | Set T-BAR position as a MIN or MAX | not tested yet | mini Series:mini-pro,mini-pro v3,mini-ISO [(3)](#api-v106)

### <a name="tested-with"></a>(*) Tested with devices

1. <a name="device-1"></a> mini, with firmware MCU VER 1.14, VIDEO VER 1.57
2. <a name="device-2"></a> mini-edge SDI, with firmware TODO VERESION

### <a name="api-list"></a>(**) API specifications
1. <a name="api-mini"></a> mini  API(EN)-20210225.pdf
2. <a name="api-mini-pro"></a> RGBlink mini-pro OpenAPI_V1.2_20220208.pdf
3. <a name="api-v106"></a> RGBlink API_V1.0.6_20250611.pdf

## **Available feedbacks (current state)**

There is few feedbacks, similiar to actions. See presets to view examples.

## **Release notes**

### Changes in 2.1.0

- Added action and changes, based on API v1.0.6 20250611, tested mini-edge SDI (TODO firmware version)
- Added extra polling commands for mini-edge SDI (as a default they are disabled in connection settings)
- Added 5th input number (BETA, not all hardware contains this button)
- Added BETA action _Switch signal source (PST or PGM)_ which should be better than _Select source and target_ but it's not tested on _mini_
- Added BETA action _Switch input signal channel (HDMI/SDI)_ for hardware with 4 HDMI and 4 SDI inputs.
- Added EXPERIMENTAL action _Set T-BAR position_ (not tested yet)