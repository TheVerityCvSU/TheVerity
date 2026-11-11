import { useState, useRef } from 'react';

export function useOtpInput({ onComplete, onClearError } = {}) {
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const resetOtp = () => {
    setOtpDigits(['', '', '', '', '', '']);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handleOtpPasteDirect = (pastedText, startIndex = 0) => {
    const clean = (pastedText || '').replace(/\D/g, '').slice(0, 6);
    if (!clean) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < clean.length; i++) {
      const targetIndex = (startIndex + i < 6) ? startIndex + i : i;
      newDigits[targetIndex] = clean[i];
    }
    setOtpDigits(newDigits);
    if (onClearError) onClearError();

    const nextFocus = Math.min(5, startIndex + clean.length);
    inputRefs.current[nextFocus]?.focus();

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('') && onComplete) {
      onComplete(fullCode);
    }
  };

  const handleOtpChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (clean.length > 1) {
      handleOtpPasteDirect(clean, index);
      return;
    }

    const char = clean.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    if (onClearError) onClearError();

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('') && onComplete) {
      onComplete(fullCode);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newDigits = [...otpDigits];
      if (!newDigits[index] && index > 0) {
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      } else {
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData?.getData('text');
    if (paste) {
      handleOtpPasteDirect(paste, 0);
      e.preventDefault();
    }
  };

  return {
    otpDigits,
    setOtpDigits,
    inputRefs,
    resetOtp,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
  };
}

