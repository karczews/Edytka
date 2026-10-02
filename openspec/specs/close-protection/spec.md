# close-protection Specification

## Purpose

Prevents silent loss of unsaved work when a window is closed, by giving the user a chance to save, discard, or cancel.

## Requirements

### Requirement: Prompt before closing a window with unsaved changes

When the user closes a window whose document has unsaved changes, Edytka SHALL show a prompt offering Save, Don't Save, and Cancel, and SHALL NOT close the window until the user chooses Save or Don't Save.

#### Scenario: Save on close
- **WHEN** a user closes a window with unsaved changes and chooses Save
- **THEN** the changes are written to the file and the window closes

#### Scenario: Discard on close
- **WHEN** a user closes a window with unsaved changes and chooses Don't Save
- **THEN** the window closes and the changes are discarded

#### Scenario: Cancel on close
- **WHEN** a user closes a window with unsaved changes and chooses Cancel
- **THEN** the window stays open and the unsaved changes remain intact

### Requirement: Clean windows close without a prompt

When the user closes a window whose document has no unsaved changes, the window SHALL close immediately without showing a prompt.

#### Scenario: Closing an unmodified document
- **WHEN** a user closes a window whose document matches the last saved state
- **THEN** the window closes with no prompt

### Requirement: Untitled documents are saved through the save dialog

When a window with an untitled document and unsaved changes is closed and the user chooses Save, Edytka SHALL show the save dialog; if the user cancels that dialog, the window SHALL stay open with its changes intact.

#### Scenario: Save dialog cancelled
- **WHEN** a user closes an untitled dirty window, chooses Save, and then cancels the save dialog
- **THEN** the window stays open and the unsaved changes remain intact

#### Scenario: Save dialog completed
- **WHEN** a user closes an untitled dirty window, chooses Save, and completes the save dialog
- **THEN** the document is written to the chosen path and the window closes

### Requirement: Failed saves on close keep the window open

If writing the document fails during a close-triggered save, Edytka SHALL keep the window open with its changes intact and inform the user of the failure.

#### Scenario: Write fails during close
- **WHEN** a user closes a dirty window, chooses Save, and writing the file fails
- **THEN** the window stays open, the unsaved changes remain intact, and the user is informed
