Option Explicit
Dim shell, fso, root, command, logon
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
logon = ""
If WScript.Arguments.Count > 0 Then
  If WScript.Arguments(0) = "--at-logon" Then logon = " -AtLogon"
End If
command = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & root & "\scripts\launcher.ps1" & Chr(34) & logon
shell.Run command, 0, False
