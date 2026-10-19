!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER

Var /GLOBAL isVerityUpdate
Var confirmDialog
Var confirmTitle
Var confirmText
Var confirmPath

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "${PRODUCT_NAME} Setup"
  !define MUI_WELCOMEPAGE_TEXT "Welcome to ${PRODUCT_NAME} Setup Wizard.$\r$\n$\r$\nThis wizard will guide you through installing or updating ${PRODUCT_NAME} on your computer.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstallMode
  ${If} $isVerityUpdate == "1"
    StrCpy $isForceCurrentInstall "1"
  ${EndIf}
!macroend

# Hook inserted right after Choose Directory and right before Install Files
!macro customPageAfterChangeDir
  PageEx custom
    PageCallbacks confirmPageCreate confirmPageLeave
    Caption " "
  PageExEnd
!macroend

Function confirmPageCreate
  GetDlgItem $0 $HWNDPARENT 1037
  GetDlgItem $1 $HWNDPARENT 1038

  ${If} $isVerityUpdate == "1"
    ${If} $0 != 0
      SendMessage $0 ${WM_SETTEXT} 0 "STR:Ready to Update"
    ${EndIf}
    ${If} $1 != 0
      SendMessage $1 ${WM_SETTEXT} 0 "STR:Setup is ready to update ${PRODUCT_NAME} to the latest version."
    ${EndIf}
  ${Else}
    ${If} $0 != 0
      SendMessage $0 ${WM_SETTEXT} 0 "STR:Ready to Install"
    ${EndIf}
    ${If} $1 != 0
      SendMessage $1 ${WM_SETTEXT} 0 "STR:Setup is ready to begin installing ${PRODUCT_NAME} on your computer."
    ${EndIf}
  ${EndIf}

  nsDialogs::Create 1018
  Pop $confirmDialog
  ${If} $confirmDialog == error
    Abort
  ${EndIf}

  ${If} $isVerityUpdate == "1"
    # Change primary action button from 'Install' to 'Update'
    GetDlgItem $0 $HWNDPARENT 1
    ${If} $0 != 0
      SendMessage $0 ${WM_SETTEXT} 0 "STR:&Update"
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "An existing installation of ${PRODUCT_NAME} was detected on this computer."
    Pop $confirmTitle

    ${NSD_CreateLabel} 0 28u 100% 24u "Setup will update all application files in the following destination folder:"
    Pop $confirmText

    ${NSD_CreateLabel} 10u 54u 95% 20u "$INSTDIR"
    Pop $confirmPath

    ${NSD_CreateLabel} 0 80u 100% 30u "Click Update to continue, or click Back if you want to review or change any settings."
    Pop $0
  ${Else}
    # Fresh Install
    GetDlgItem $0 $HWNDPARENT 1
    ${If} $0 != 0
      SendMessage $0 ${WM_SETTEXT} 0 "STR:&Install"
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "Setup is now ready to begin installing ${PRODUCT_NAME} on your computer."
    Pop $confirmTitle

    ${NSD_CreateLabel} 0 28u 100% 24u "The application will be installed into the following destination folder:"
    Pop $confirmText

    ${NSD_CreateLabel} 10u 54u 95% 20u "$INSTDIR"
    Pop $confirmPath

    ${NSD_CreateLabel} 0 80u 100% 30u "Click Install to begin the installation, or click Back to review your settings."
    Pop $0
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function confirmPageLeave
FunctionEnd

!macro customInit
  StrCpy $isVerityUpdate "0"
  StrCpy $0 ""

  # 1. Check HKCU InstallLocation from electron-builder's app GUID
  ReadRegStr $0 HKCU "Software\${APP_GUID}" "InstallLocation"

  # 2. Check HKCU Uninstall key
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  ${EndIf}

  # 3. Check HKLM InstallLocation
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\${APP_GUID}" "InstallLocation"
  ${EndIf}

  # 4. Check HKLM Uninstall key
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  ${EndIf}

  # 5. Check default per-user folder
  ${If} $0 == ""
    ${If} ${FileExists} "$LocalAppData\Programs\${PRODUCT_FILENAME}\${PRODUCT_FILENAME}.exe"
      StrCpy $0 "$LocalAppData\Programs\${PRODUCT_FILENAME}"
    ${EndIf}
  ${EndIf}

  # 6. Check ProgramFiles folder
  ${If} $0 == ""
    ${If} ${FileExists} "$ProgramFiles\${PRODUCT_FILENAME}\${PRODUCT_FILENAME}.exe"
      StrCpy $0 "$ProgramFiles\${PRODUCT_FILENAME}"
    ${EndIf}
  ${EndIf}

  # If existing installation found and executable exists
  ${If} $0 != ""
  ${AndIf} ${FileExists} "$0\${PRODUCT_FILENAME}.exe"
    StrCpy $isVerityUpdate "1"
    StrCpy $INSTDIR $0
    StrCpy $perUserInstallationFolder $0
  ${EndIf}
!macroend

!endif
