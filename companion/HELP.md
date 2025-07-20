# RGBlink mini

This module was initially created only for the mini. However, somu actions was tested with mini, other with mini-edge SDI. See details in table below.
Some actions should also works on mini+, mini-pro or other.

Devices must be controlled over a network, USB control is NOT supported.

## **Available commands**

| Command    | Description     | Tested with (*) | Declarative API compatibility |
|---------------------------------|-----------------------------------------------------|-------------|--|
| Select source and target | Source input (1–5) and output (Live or Preview).  | mini [(1)](#device-1),<br> mini-edge SDI [(2)](#device-2) |
| BETA Switch signal source (PST or PGM) | 



| Build PIP from selected sources | Select PIP mode, two sources, and output (Live or Preview).                |
| Switch to signal source         | Switch to a specific source input (like pressing 1/2/3/4 on the device).   |
| Set switch mode                 | Choose T-BAR or Auto mode for switching.                                   |
| Set Picture-In-Picture mode     | Choose a specific PIP mode.                                                |
| Set switch effect               | Define the transition effect.                                              |
| Set PIP layer (A or B)          | Choose whether the PIP appears as layer A or B.                            |


- Select source and target (source - input 1/2/3/4/5(if the hardware has), target - Live output or preveiw)
- Build PIP from selected sources (select PIP mode and two sources for PIP, and target - live output or preview)
- Switch to signal source (Like pressing the 1/2/3/4 source button on the device)
- Set switch mode (T-BAR/Auto)
- Set Picture-In-Picture mode
- Set switch effect
- Set PIP layer (A or B)

Build PIP from selected sources
EXPERIMENTAL Set T-BAR position
    Based on API v1.0.6 20250611, is it possible on mini Series:mini-pro,mini-pro v3,mini-ISO

    Based on API v1.0.6 20250611, is it possible on mini Series:mini-pro,mini-pro v3,mini-ISO
EXPERIMENTAL: Switch input signal channel (HDMI/SDI)
    Based on API v1.0.6 20250611, mini-iso, mini-edge SDI, mini-mx SDI
Picture-In-Picture mode
PIP layer (A or B)
Switch effect
Switch mode (T-BAR/Auto)
Switch signal source

### Tested with devices

1. <a name="device-1"></a> mini, with firmware MCU VER 1.14, VIDEO VER 1.57
2. <a name="device-2"></a> mini-edge SDI, with firmware TODO VERESION


## **Available feedbacks (current state) for mini**

- Live source (1/2/3/4 - for PIP off or layer A when PIP on)
- Preview source (1/2/3/4 - for PIP off or layer A when PIP on)
- Selected switch mode (T-BAR/Auto)
- Selected PIP mode
- Selected PIP layer
- Selected switch effect

See presets to view examples

## **Changes in 2.1.0**

- Added action and changes, based on API v1.0.6 20250611, tested mini-edge SDI (TODO firmware version)
- Added extra polling commands for mini-edge SDI (as a default they are disabled in connection settings)