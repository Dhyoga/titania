## ADDED Requirements

### Requirement: A frame without clips of its own is not offered in Display
A frame that has no clip set of its own (Erza) SHALL NOT be a Display model and SHALL NOT be a section of the Display menu's Animations popover.
The Model popover SHALL list the frames that can be shown in Display only. A saved Display model that names such a frame SHALL be replaced by the
default (Shukra's Generic) without an error. The lobby's lenders and idles SHALL come only from frames that have a clip set. In Playground the frame
SHALL be shown as any other.

#### Scenario: Model popover
- **WHEN** the Display menu's Model popover is opened
- **THEN** it lists Shukra and Pavo, and not Erza

#### Scenario: Animations popover
- **WHEN** the Animations popover is opened with Shukra as the Display model
- **THEN** it has sections for Shukra and Pavo only

#### Scenario: Saved Erza
- **WHEN** the stored Display model is Erza (an edited record or an import)
- **THEN** the panel opens on Shukra's Generic without an error, and the stored value is kept

#### Scenario: Playground
- **WHEN** Erza is chosen in Playground and the panel is switched to Display
- **THEN** Display shows the saved Display model (Shukra's Generic by default) and the saved Display model is unchanged
