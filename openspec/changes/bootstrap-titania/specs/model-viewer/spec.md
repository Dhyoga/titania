## MODIFIED Requirements

### Requirement: Default skin is shown in the stage card
When the panel opens, it SHALL load the Display model's GLB (see `display-mode`; by default the active construct's default skin) from
`/<constructId>/models/<skin>.glb` and render it inside the stage card, upright, facing the camera. In Playground the default framing
SHALL show the whole body with some headroom above the head; Display uses its own camera.

#### Scenario: Model appears
- **WHEN** the side panel opens with no Display model saved and is switched to Playground
- **THEN** the stage card shows Shukra's Generic (`/shukra/models/r3qumd010011.glb`) from the front, feet and head both inside the card, over the stage gradient

#### Scenario: Framing follows the model
- **WHEN** a different model is loaded into the viewer in Playground
- **THEN** the camera is framed from that model's bounds without any construct-specific numbers

### Requirement: Default framing fits the body's height to the whole canvas
The default framing SHALL fit the model's height to the whole canvas with a small, even margin above the crown and below the feet, and
SHALL treat the model's width only as a loose limit (0.8 of the bounds' width for a person, the full width for a chibi), so that in a tall narrow panel
the body fills the height. Controls laid over the stage SHALL NOT change the framing: hiding or showing one SHALL NOT move the camera
or the model. A camera the user has moved SHALL keep its position when the canvas changes size.

#### Scenario: Tall narrow panel
- **WHEN** a person's model is shown at its default framing in a panel 387 px wide and 1045 px tall
- **THEN** the crown is within the top 18 % of the canvas, the feet are within the bottom 18 % (a bar laid over the bottom may cover them), and the torso is inside the width

#### Scenario: Every frame
- **WHEN** the default skin of each of the two frames is shown at the default framing at 320, 387 and 600 px wide
- **THEN** each body fills at least 55 % of the canvas height and its torso is inside the width

#### Scenario: A bar over the bottom
- **WHEN** a control bar over the bottom of the stage is hidden or shown
- **THEN** the camera and the model do not move; the feet are visible only when the bar is hidden

#### Scenario: Panel resized
- **WHEN** the panel is resized and the camera was not moved by the user
- **THEN** the default framing is recomputed for the new size; a camera the user moved stays where it is

### Requirement: No part disappears up close
Every mesh of the shown model, and its outline, SHALL be drawn whatever the camera's distance and angle and the clip's pose; no part
SHALL be skipped because of a bounding volume that does not follow the animation.

#### Scenario: Face close-up during a Board action
- **WHEN** Shukra plays `BoardAct0201`, paused mid-clip, with the camera at its closest on the face and turned around it
- **THEN** the eyes and the face stay drawn at every angle
