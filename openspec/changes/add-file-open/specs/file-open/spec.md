# Spec Delta

## Purpose

Lets the operating system hand files to Edytka and ensures each file opens in a window with its contents displayed.

## ADDED Requirements

### Requirement: System recognizes Edytka for its document types

After installation, the operating system SHALL list Edytka as an application that can open files with the extensions `md`, `markdown`, `rs`, `kt`, `kts`, `java`, `cs`, and `txt`, as an editor.

#### Scenario: Open With lists Edytka
- **WHEN** a user opens the "Open With" menu for a `.md` file on macOS
- **THEN** Edytka appears in the list of applications

#### Scenario: Open With lists Edytka for text files
- **WHEN** a user opens the "Open With" menu for a `.txt` file on macOS
- **THEN** Edytka appears in the list of applications

### Requirement: Opening a file with Edytka loads its contents

When the system requests Edytka to open a file — whether at launch or while already running — Edytka SHALL display that file's contents in an editor window.

#### Scenario: Cold-start open of a single file
- **WHEN** a user double-clicks a `.md` file and Edytka is not running
- **THEN** Edytka starts and shows the file's contents in exactly one window

#### Scenario: Warm open while running
- **WHEN** a user double-clicks a `.md` file while Edytka is already running
- **THEN** the file's contents are shown in a window without restarting the app

#### Scenario: Forced open via Open With
- **WHEN** a user forces the system to open a file with Edytka from the "Open With" menu
- **THEN** Edytka shows that file's contents instead of an empty untitled buffer

#### Scenario: Multiple files opened at once
- **WHEN** the system asks Edytka to open several files in one request
- **THEN** each file is shown in its own window

### Requirement: Reuse of the pristine untitled window

When Edytka is asked to open a file and an existing window shows the untitled document with no unsaved changes, that window SHALL display the file; a new window SHALL be created only when no such window is available.

#### Scenario: Cold start reuses the startup window
- **WHEN** Edytka starts because a file was double-clicked
- **THEN** the startup window shows that file, and no second window is created

#### Scenario: Dirty untitled window is preserved
- **WHEN** a file is opened and the only untitled window contains unsaved changes
- **THEN** a new window shows the file and the unsaved changes remain intact in their window

#### Scenario: Document windows are never reused
- **WHEN** a file is opened while the existing window shows an already-opened document
- **THEN** a new window shows the incoming file

### Requirement: Each window identifies its document

Each window SHALL display the filename of its open document in the title bar, or the name "untitled" when no document is open.

#### Scenario: Titled window
- **WHEN** a window shows the file `notes.md`
- **THEN** the window's title is `notes.md`

#### Scenario: Untitled window
- **WHEN** a window has no open document
- **THEN** the window's title is `untitled`

### Requirement: Failed opens are reported

When a file handed to Edytka cannot be read, Edytka SHALL inform the user of the failure and remain fully usable.

#### Scenario: Unreadable file
- **WHEN** the system asks Edytka to open a file that cannot be read (for example, a permission error)
- **THEN** the user is shown an error and Edytka remains open and usable
