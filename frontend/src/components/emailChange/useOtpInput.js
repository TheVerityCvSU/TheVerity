import { useState, useRef } from 'react';

export function useOtpInput(onComplete) {
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const digitInputRefs = useRef([]);

  const resetOtp = () => {
    setOtpDigits(['', '', '', '', '', '']);
  };

  const handleDigitChange = (index, value, setError) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (clean.length > 1) {
      handlePasteDirect(clean, index, setError);
      return;
    }

    const char = clean.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    if (setError) setError('');

    if (char && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      onComplete(fullCode);
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newDigits = [...otpDigits];
      if (!newDigits[index] && index > 0) {
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        digitInputRefs.current[index - 1]?.focus();
        e.preventDefault();
      } else {
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePasteDirect = (pastedText, startIndex = 0, setError) => {
    const clean = (pastedText || '').replace(/\D/g, '').slice(0, 6);
    if (!clean) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < clean.length; i++) {
      const targetIndex = (startIndex + i < 6) ? startIndex + i : i;
      newDigits[targetIndex] = clean[i];
    }
    setOtpDigits(newDigits);
    if (setError) setError('');

    const nextFocus = Math.min(5, startIndex + clean.length);
    digitInputRefs.current[nextFocus]?.focus();

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      onComplete(fullCode);
    }
  };

  const handlePaste = (e, setError) => {
    const paste = e.clipboardData?.getData('text') || '';
    if (paste) {
      handlePasteDirect(paste, 0, setError);
      e.preventDefault();
    }
  };

  return {
    otpDigits,
    digitInputRefs,
    resetOtp,
    handleDigitChange,
    handleDigitKeyDown,
    handlePasteDirect,
    handlePaste
  };
}

