# large-file-handling Specification

## Purpose

Defines how Edytka handles files too large for comfortable syntax-highlighted editing, by degrading to a fast plain-text mode.

## Requirements

### Requirement: Files above the size threshold open without syntax highlighting

When Edytka opens a file whose size is strictly greater than 20 MiB (20 × 1024 × 1024 bytes), it SHALL display the file's contents without syntax highlighting, keeping the editor responsive.

#### Scenario: Large markdown file opens in plain-text mode
- **WHEN** the user opens a `.md` file larger than 20 MiB
- **THEN** the file's contents are displayed without syntax highlighting and scrolling remains responsive

#### Scenario: Boundary file keeps highlighting
- **WHEN** the user opens a file of exactly 20 MiB
- **THEN** the file's contents are displayed with normal syntax highlighting

#### Scenario: Smaller file is unaffected
- **WHEN** the user opens a file smaller than 20 MiB
- **THEN** the file's contents are displayed with normal syntax highlighting

### Requirement: Large-file mode is indicated

While a file is open in large-file mode, the window SHALL display an indicator stating that syntax highlighting is off. The indicator SHALL NOT be shown when the open document uses normal highlighting.

#### Scenario: Indicator shown for a large file
- **WHEN** the user opens a file larger than 20 MiB
- **THEN** the window shows an indicator that syntax highlighting is off

#### Scenario: Indicator hidden for a normal file
- **WHEN** the open document is 20 MiB or smaller
- **THEN** the window shows no large-file indicator

### Requirement: Opening a smaller file restores normal mode

When a file at or below the threshold is opened after a large file, Edytka SHALL restore syntax highlighting and hide the indicator. The mode applies per open and per window.

#### Scenario: Large file followed by a smaller file
- **WHEN** the user opens a file larger than 20 MiB and then opens a file of 20 MiB or smaller in the same window
- **THEN** the smaller file is displayed with normal syntax highlighting and no large-file indicator

### Requirement: Saving a large file preserves its mode

When a document open in large-file mode is saved, the window SHALL remain in large-file mode.

#### Scenario: Save keeps the fallback active
- **WHEN** the user saves a file open in large-file mode
- **THEN** the document remains displayed without syntax highlighting and the indicator remains visible
