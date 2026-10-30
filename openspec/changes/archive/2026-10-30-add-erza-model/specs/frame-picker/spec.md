## MODIFIED Requirements

### Requirement: Frame list
The panel SHALL offer Erza and Qu's frames Shukra and Pavo, in that order, from the construct configurations. The panel SHALL open on the Display
model's frame (see `display-mode`), which is Shukra unless the user chose another; Erza is never the Display model in this version.

#### Scenario: Open the panel
- **WHEN** the side panel opens and no Display model is saved
- **THEN** Shukra's Generic is loaded, and switching to Playground shows Shukra in the header

#### Scenario: Saved Display model
- **WHEN** the Display model is Pavo's Generic and the side panel opens
- **THEN** Pavo's Generic is loaded, and switching to Playground shows Pavo in the header

#### Scenario: Erza is first in the picker
- **WHEN** in Playground the header picker is opened
- **THEN** it lists Erza, Shukra and Pavo in that order, and choosing Erza shows her for Playground only, leaving the Display model unchanged

#### Scenario: Board action onto Erza
- **WHEN** `BoardAct0201` plays on Shukra and Erza is chosen
- **THEN** Erza is shown and plays `Shukra · BoardAct0201`, retargeted, from 0 with Shukra's paired line
