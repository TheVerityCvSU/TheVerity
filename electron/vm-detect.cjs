/**
 * The Verity — Virtual Machine (VM) Detection Module
 * 
 * Inspects system hardware drivers, BIOS/Motherboard metadata,
 * disk controllers, video display adapters, and network MAC addresses
 * to detect whether The Verity is running inside a virtualized environment
 * (e.g., VirtualBox, VMware, Microsoft Hyper-V, QEMU/KVM, Parallels, Xen).
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// IEEE Registered Virtualization Vendor MAC OUI prefixes
const VM_MAC_OUIS = [
  { prefix: '00:05:69', vendor: 'VMware' },
  { prefix: '00:0c:29', vendor: 'VMware' },
  { prefix: '00:1c:14', vendor: 'VMware' },
  { prefix: '00:50:56', vendor: 'VMware' },
  { prefix: '08:00:27', vendor: 'Oracle VirtualBox' },
  { prefix: '00:15:5d', vendor: 'Microsoft Hyper-V' },
  { prefix: '00:03:ff', vendor: 'Microsoft Hyper-V' },
  { prefix: '52:54:00', vendor: 'QEMU / KVM' },
  { prefix: '00:1c:42', vendor: 'Parallels' },
  { prefix: '00:16:3e', vendor: 'Xen' }
];

// Guest-specific driver files installed inside virtual machine OS
const VM_DRIVER_FILES = [
  { file: 'VBoxGuest.sys', vendor: 'VirtualBox Guest Additions' },
  { file: 'VBoxMouse.sys', vendor: 'VirtualBox Mouse Driver' },
  { file: 'VBoxSF.sys', vendor: 'VirtualBox Shared Folder Driver' },
  { file: 'VBoxVideo.sys', vendor: 'VirtualBox Video Driver' },
  { file: 'VBoxWddm.sys', vendor: 'VirtualBox WDDM Driver' },
  { file: 'vmmouse.sys', vendor: 'VMware Tools Mouse Driver' },
  { file: 'vmhgfs.sys', vendor: 'VMware Host-Guest Filesystem' },
  { file: 'vmusbmouse.sys', vendor: 'VMware USB Mouse Driver' },
  { file: 'vm3dmp.sys', vendor: 'VMware SVGA 3D Driver' },
  { file: 'viostor.sys', vendor: 'QEMU/KVM VirtIO Storage Driver' },
  { file: 'vioscsi.sys', vendor: 'QEMU/KVM VirtIO SCSI Driver' },
  { file: 'netkvm.sys', vendor: 'QEMU/KVM VirtIO Network Driver' },
  { file: 'qxl.sys', vendor: 'QEMU QXL Video Driver' },
  { file: 'xennet.sys', vendor: 'Xen Network Driver' },
  { file: 'xenvbd.sys', vendor: 'Xen Storage Driver' }
];

let cachedResult = null;
let detectionPromise = null;

/**
 * Checks system network interfaces for MAC addresses belonging to VM vendors.
 */
function checkMacAddresses() {
  const interfaces = os.networkInterfaces();
  const detected = [];

  for (const [ifaceName, addrs] of Object.entries(interfaces)) {
    for (const item of (addrs || [])) {
      if (!item.mac || item.mac === '00:00:00:00:00:00') continue;
      const cleanMac = item.mac.toLowerCase();
      for (const oui of VM_MAC_OUIS) {
        if (cleanMac.startsWith(oui.prefix)) {
          detected.push({
            type: 'mac',
            vendor: oui.vendor,
            interface: ifaceName,
            mac: cleanMac,
            ip: item.address,
            reason: `Virtual Network Adapter detected: ${oui.vendor} (MAC: ${cleanMac} on "${ifaceName}")`
          });
        }
      }
    }
  }
  return detected;
}

/**
 * Checks for guest-integration driver files installed in Windows System32 drivers directory.
 */
function checkDriverFiles() {
  if (process.platform !== 'win32') return [];
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const driversDir = path.join(systemRoot, 'System32', 'drivers');

  const detected = [];
  for (const item of VM_DRIVER_FILES) {
    try {
      const fullPath = path.join(driversDir, item.file);
      if (fs.existsSync(fullPath)) {
        detected.push({
          type: 'driver',
          vendor: item.vendor,
          file: item.file,
          reason: `VM Guest Driver installed: ${item.file} (${item.vendor})`
        });
      }
    } catch (_) {}
  }
  return detected;
}

/**
 * Queries Windows CIM/WMI for hardware system, BIOS, disk drive, and video controller info.
 */
function checkHardwareWmi() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve([]);
    }

    const psStatements = [
      '$cs = Get-CimInstance Win32_ComputerSystem | Select-Object -Property Manufacturer, Model',
      '$bios = Get-CimInstance Win32_BIOS | Select-Object -Property Manufacturer, SerialNumber, SMBIOSBIOSVersion',
      '$disk = @(Get-CimInstance Win32_DiskDrive | Select-Object -Property Model)',
      '$video = @(Get-CimInstance Win32_VideoController | Select-Object -Property Name)',
      '[PSCustomObject]@{ csManufacturer = $cs.Manufacturer; csModel = $cs.Model; biosManufacturer = $bios.Manufacturer; biosSerial = $bios.SerialNumber; biosVersion = $bios.SMBIOSBIOSVersion; disks = ($disk | ForEach-Object { $_.Model }); gpus = ($video | ForEach-Object { $_.Name }) } | ConvertTo-Json -Compress'
    ].join('; ');

    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psStatements}"`;
    exec(cmd, { timeout: 6000 }, (error, stdout) => {
      if (error || !stdout) {
        return resolve([]);
      }

      try {
        const data = JSON.parse(stdout.trim());
        const detected = [];

        const csMan = (data.csManufacturer || '').toLowerCase();
        const csMod = (data.csModel || '').toLowerCase();
        const biosMan = (data.biosManufacturer || '').toLowerCase();
        const biosSer = (data.biosSerial || '').toLowerCase();
        const biosVer = (data.biosVersion || '').toLowerCase();
        const disks = Array.isArray(data.disks) ? data.disks : (data.disks ? [data.disks] : []);
        const gpus = Array.isArray(data.gpus) ? data.gpus : (data.gpus ? [data.gpus] : []);

        const vmKeywords = [
          { pattern: 'virtualbox', vendor: 'VirtualBox' },
          { pattern: 'vbox', vendor: 'VirtualBox' },
          { pattern: 'innotek', vendor: 'VirtualBox' },
          { pattern: 'vmware', vendor: 'VMware' },
          { pattern: 'qemu', vendor: 'QEMU' },
          { pattern: 'kvm', vendor: 'KVM' },
          { pattern: 'xen', vendor: 'Xen' },
          { pattern: 'parallels', vendor: 'Parallels' },
          { pattern: 'bochs', vendor: 'Bochs' },
          { pattern: 'hvm domu', vendor: 'Xen' }
        ];

        for (const kw of vmKeywords) {
          if (csMan.includes(kw.pattern)) detected.push({ type: 'hardware_cs', vendor: kw.vendor, reason: `System Manufacturer indicates ${kw.vendor}: "${data.csManufacturer}"` });
          if (csMod.includes(kw.pattern)) detected.push({ type: 'hardware_cs', vendor: kw.vendor, reason: `System Model indicates ${kw.vendor}: "${data.csModel}"` });
          if (biosMan.includes(kw.pattern)) detected.push({ type: 'hardware_bios', vendor: kw.vendor, reason: `BIOS Manufacturer indicates ${kw.vendor}: "${data.biosManufacturer}"` });
          if (biosSer.includes(kw.pattern)) detected.push({ type: 'hardware_bios', vendor: kw.vendor, reason: `BIOS Serial indicates ${kw.vendor}: "${data.biosSerial}"` });
          if (biosVer.includes(kw.pattern)) detected.push({ type: 'hardware_bios', vendor: kw.vendor, reason: `BIOS Version indicates ${kw.vendor}: "${data.biosVersion}"` });
        }

        // Microsoft Hyper-V detection
        if (csMan.includes('microsoft') && (csMod.includes('virtual') || csMod.includes('hyper-v'))) {
          detected.push({ type: 'hardware_cs', vendor: 'Microsoft Hyper-V', reason: `Microsoft Hyper-V Virtual Machine detected: "${data.csModel}"` });
        }

        // Virtual disk drives
        for (const d of disks) {
          const dl = String(d).toLowerCase();
          for (const kw of ['vbox', 'vmware', 'qemu', 'virtio', 'virtual disk', 'virtual hd']) {
            if (dl.includes(kw)) {
              detected.push({ type: 'hardware_disk', vendor: kw.toUpperCase(), reason: `Virtual Disk Drive detected: "${d}"` });
              break;
            }
          }
        }

        // Virtual display / video controllers
        for (const g of gpus) {
          const gl = String(g).toLowerCase();
          for (const kw of ['virtualbox', 'vbox', 'vmware', 'hyper-v video', 'qemu', 'qxl', 'virtio', 'parallels display']) {
            if (gl.includes(kw)) {
              detected.push({ type: 'hardware_gpu', vendor: kw.toUpperCase(), reason: `Virtual Display Adapter detected: "${g}"` });
              break;
            }
          }
        }

        resolve(detected);
      } catch (_) {
        resolve([]);
      }
    });
  });
}

/**
 * Runs the comprehensive VM detection check.
 * Checks drivers, MAC addresses, and hardware WMI.
 */
async function detectVirtualMachine() {
  const driverMatches = checkDriverFiles();
  const macMatches = checkMacAddresses();
  const hardwareMatches = await checkHardwareWmi();

  const allHits = [...driverMatches, ...hardwareMatches, ...macMatches];
  const isVm = allHits.length > 0;
  const reasons = allHits.map((h) => h.reason);

  cachedResult = {
    isVm,
    checkedAt: new Date().toISOString(),
    reasons,
    hits: allHits,
    summary: isVm
      ? `Virtual Machine detected (${allHits.length} indicator${allHits.length > 1 ? 's' : ''}): ${reasons[0]}`
      : 'Physical machine verified (No virtual machine indicators detected)'
  };

  return cachedResult;
}

/**
 * Initializes VM detection at system startup (synchronous trigger, runs async in background).
 */
function initStartupVmDetection(logger = console.log) {
  logger('[vm-detect] Initializing startup VM detection check...');
  if (!detectionPromise) {
    detectionPromise = detectVirtualMachine()
      .then((res) => {
        if (res.isVm) {
          logger(`[vm-detect] WARNING: VIRTUAL MACHINE DETECTED! Reasons:\n  - ${res.reasons.join('\n  - ')}`);
        } else {
          logger('[vm-detect] Physical machine verified. Safe for exam execution.');
        }
        return res;
      })
      .catch((err) => {
        logger(`[vm-detect] Error running VM detection: ${err.message}`);
        cachedResult = { isVm: false, error: err.message, reasons: [] };
        return cachedResult;
      });
  }
  return detectionPromise;
}

/**
 * Returns the cached VM detection status, or awaits completion if still running.
 */
async function getVmStatus() {
  if (cachedResult) return cachedResult;
  if (detectionPromise) return await detectionPromise;
  return await detectVirtualMachine();
}

/**
 * Synchronous getter for current cached status (returns default safe false if pending).
 */
function getCachedVmStatusSync() {
  return cachedResult || { isVm: false, pending: true, reasons: [] };
}

module.exports = {
  detectVirtualMachine,
  initStartupVmDetection,
  getVmStatus,
  getCachedVmStatusSync,
  checkMacAddresses,
  checkDriverFiles
};
