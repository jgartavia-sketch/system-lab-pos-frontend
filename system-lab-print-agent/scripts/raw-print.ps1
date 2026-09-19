param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath,
  [string]$DocumentName = "System Lab POS"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "No se encontró el archivo temporal de impresión."
}

$printer = Get-CimInstance Win32_Printer -Filter "Name='$($PrinterName.Replace("'", "''"))'" -ErrorAction SilentlyContinue
if (-not $printer) {
  throw "Windows no encontró la impresora '$PrinterName'."
}
if ($printer.WorkOffline) {
  throw "La impresora '$PrinterName' figura sin conexión."
}

if (-not ("SystemLab.RawPrinter" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace SystemLab {
  public static class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private class DOC_INFO_1 {
      [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
      [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
      [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool OpenPrinter(string printerName, out IntPtr printer, IntPtr defaults);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int StartDocPrinter(IntPtr printer, int level, [In] DOC_INFO_1 docInfo);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr printer, byte[] bytes, int count, out int written);

    public static void Send(string printerName, byte[] bytes, string documentName) {
      IntPtr handle;
      if (!OpenPrinter(printerName, out handle, IntPtr.Zero))
        throw new Win32Exception(Marshal.GetLastWin32Error(), "No se pudo abrir la impresora.");
      try {
        var doc = new DOC_INFO_1 { pDocName = documentName, pDataType = "RAW" };
        if (StartDocPrinter(handle, 1, doc) == 0)
          throw new Win32Exception(Marshal.GetLastWin32Error(), "No se pudo iniciar el documento RAW.");
        try {
          if (!StartPagePrinter(handle))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "No se pudo iniciar la página.");
          try {
            int written;
            if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length)
              throw new Win32Exception(Marshal.GetLastWin32Error(), "Windows no recibió todos los bytes de la comanda.");
          } finally { EndPagePrinter(handle); }
        } finally { EndDocPrinter(handle); }
      } finally { ClosePrinter(handle); }
    }
  }
}
"@
}

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $FilePath))
[SystemLab.RawPrinter]::Send($PrinterName, $bytes, $DocumentName)
Write-Output "OK"
