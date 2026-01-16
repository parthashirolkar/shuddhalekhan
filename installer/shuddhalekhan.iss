; शुद्धलेखन (Shuddhalekhan) Inno Setup Script
; Desktop Speech-to-Text application using OpenAI Whisper

[Setup]
AppName=शुद्धलेखन (Shuddhalekhan)
AppVersion=0.2.0
AppPublisher=Open Source
DefaultDirName={autopf}\Shuddhalekhan
DefaultGroupName=शुद्धलेखन
OutputBaseFilename=shuddhalekhan-setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayIcon={app}\shuddhalekhan.ico
SetupIconFile=..\assets\shuddhalekhan.ico
; WizardImageFile and WizardSmallImageFile require specific BMP dimensions
; Uncomment if you create proper BMP files (164x314 and 55x58 pixels)
; WizardImageFile=..\assets\wizard.bmp
; WizardSmallImageFile=..\assets\wizard-small.bmp
ChangesAssociations=yes
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Main application files
Source: "..\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\main.py"; DestDir: "{app}"; Flags: ignoreversion

; Icon file for tray
Source: "..\assets\shuddhalekhan.ico"; DestDir: "{app}"; Flags: ignoreversion

; License file
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userdesktop}\शुद्धलेखन"; Filename: "{app}\main.py"; Parameters: """-m app.main"""; IconFilename: "{app}\shuddhalekhan.ico"; IconIndex: 0

[Run]
; No automatic run after install - user will start from shortcut

[UninstallDelete]
; Clean up on uninstall
Type: filesandordirs; Name: "{app}"

[Registry]
; Register application
Root: HKCU; Subkey: "Software\शुद्धलेखन"; ValueType: string; ValueName: "Installed"; ValueData: "1"; Flags: dontcreatekey
