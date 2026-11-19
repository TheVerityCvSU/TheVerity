import React, { useState, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

/**
 * Accessible ComboBox Component (Principle 14)
 * - Real-time typing dynamic filtering
 * - ARIA accessibility (role="combobox", aria-expanded, aria-activedescendant)
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
 * - Origin-aware entrance spring animation (Principle 17, 19)
 * - Minimum 44px touch targets on all interactive items (Principle 10)
 * - Tabular numbers on badges and count (Principle 3)
 * - High-affordance visual feedback (Principle 13)
 */
export default function ComboBox({
  options = [],
  value = null,
  onChange = () => {},
  placeholder = 'Select option...',
  searchPlaceholder = 'Type to filter...',
  label = null,
  emptyText = 'No matches found',
  className = '',
  disabled = false,
  origin = 'top-left' // 'top-left' | 'top-right'
}) {
  const { isDark } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxId = useId();
  const comboboxId = useId();

  // Normalize options to { value, label, subtext, count }
  const normalizedOptions = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value ?? opt.id ?? opt.name,
          label: opt.label ?? opt.name ?? String(opt.value),
          subtext: opt.subtext ?? opt.desc ?? null,
          count: opt.count ?? null
        };
      }
      return { value: opt, label: String(opt), subtext: null, count: null };
    });
  }, [options]);

  // Real-time dynamic filtering (Principle 14)
  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return normalizedOptions;
    const lower = query.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        (opt.subtext && opt.subtext.toLowerCase().includes(lower))
    );
  }, [normalizedOptions, query]);

  // Selected item label
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const activeDescendantId =
    highlightedIndex >= 0 && filteredOptions[highlightedIndex]
      ? `${listboxId}-opt-${highlightedIndex}`
      : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full ${className}`}
      style={{ position: 'relative', width: '100%' }}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label
          htmlFor={comboboxId}
          style={{
            display: 'block',
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.04em',
            marginBottom: '6px',
            color: isDark ? 'oklch(0.75 0.01 260)' : 'oklch(0.48 0.02 260)'
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger Button (Min 44px height for touch target affordance) */}
      <button
        ref={triggerRef}
        id={comboboxId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendantId}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          minHeight: '44px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          borderRadius: '10px',
          border: isDark
            ? isOpen ? '1.5px solid oklch(0.72 0.17 160)' : '1px solid oklch(0.38 0.008 260)'
            : isOpen ? '1.5px solid oklch(0.68 0.18 160)' : '1px solid oklch(0.88 0.01 240)',
          backgroundColor: isDark ? 'oklch(0.28 0.005 260)' : 'oklch(1 0 0)',
          color: isDark ? 'oklch(0.94 0.005 260)' : 'oklch(0.20 0.02 260)',
          fontSize: '0.92rem',
          fontWeight: '500',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen
            ? '0 0 0 3px oklch(0.68 0.18 160 / 0.18)'
            : '0 1px 3px rgba(0,0,0,0.04)',
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
          outline: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : (
            <span style={{ color: isDark ? 'oklch(0.60 0.01 260)' : 'oklch(0.62 0.02 260)' }}>
              {placeholder}
            </span>
          )}
        </span>

        <ChevronDown
          size={18}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            color: isDark ? 'oklch(0.60 0.01 260)' : 'oklch(0.62 0.02 260)',
            flexShrink: 0
          }}
        />
      </button>

      {/* Origin-Aware Animated Dropdown Panel (Principles 17 & 19) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 4 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: origin === 'top-right' ? 'auto' : 0,
              right: origin === 'top-right' ? 0 : 'auto',
              width: '100%',
              minWidth: '220px',
              maxWidth: '400px',
              zIndex: 300,
              transformOrigin: origin === 'top-right' ? 'top right' : 'top left',
              backgroundColor: isDark ? 'oklch(0.26 0.005 260)' : 'oklch(1 0 0)',
              borderRadius: '12px',
              border: isDark ? '1px solid oklch(0.38 0.008 260)' : '1px solid oklch(0.88 0.01 240)',
              boxShadow: isDark
                ? '0 12px 32px rgba(0, 0, 0, 0.55), 0 0 16px oklch(0.72 0.17 160 / 0.12)'
                : '0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0,0,0,0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Real-time Dynamic Filter Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderBottom: isDark ? '1px solid oklch(0.34 0.006 260)' : '1px solid oklch(0.92 0.006 240)',
                backgroundColor: isDark ? 'oklch(0.24 0.005 260)' : 'oklch(0.985 0.003 240)'
              }}
            >
              <Search
                size={16}
                style={{
                  color: isDark ? 'oklch(0.60 0.01 260)' : 'oklch(0.62 0.02 260)',
                  flexShrink: 0
                }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                aria-autocomplete="list"
                aria-controls={listboxId}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.88rem',
                  color: isDark ? 'oklch(0.94 0.005 260)' : 'oklch(0.20 0.02 260)',
                  fontFamily: 'inherit'
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDark ? 'oklch(0.60 0.01 260)' : 'oklch(0.62 0.02 260)'
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtered Options Listbox */}
            <ul
              id={listboxId}
              role="listbox"
              style={{
                listStyle: 'none',
                margin: 0,
                padding: '6px',
                maxHeight: '240px',
                overflowY: 'auto',
                scrollbarWidth: 'thin'
              }}
            >
              {filteredOptions.length === 0 ? (
                <li
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: isDark ? 'oklch(0.60 0.01 260)' : 'oklch(0.62 0.02 260)'
                  }}
                >
                  {emptyText}
                </li>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <li
                      key={opt.value}
                      id={`${listboxId}-opt-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      style={{
                        minHeight: '44px', // Principle 10: 44px Touch Target
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                        fontWeight: isSelected ? '600' : '400',
                        backgroundColor: isHighlighted
                          ? isDark ? 'oklch(0.33 0.005 260)' : 'oklch(0.95 0.008 240)'
                          : isSelected
                            ? isDark ? 'oklch(0.30 0.04 160)' : 'oklch(0.96 0.03 160)'
                            : 'transparent',
                        color: isSelected
                          ? isDark ? 'oklch(0.78 0.16 160)' : 'oklch(0.60 0.18 160)'
                          : isDark ? 'oklch(0.94 0.005 260)' : 'oklch(0.20 0.02 260)',
                        transition: 'background-color 0.12s ease'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{opt.label}</span>
                        {opt.subtext && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              color: isDark ? 'oklch(0.60 0.01 260)' : 'oklch(0.62 0.02 260)'
                            }}
                          >
                            {opt.subtext}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {opt.count !== null && (
                          <span
                            className="tabular-nums"
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isDark ? 'oklch(0.32 0.005 260)' : 'oklch(0.93 0.006 240)',
                              color: isDark ? 'oklch(0.75 0.01 260)' : 'oklch(0.48 0.02 260)'
                            }}
                          >
                            {opt.count}
                          </span>
                        )}
                        {isSelected && (
                          <Check
                            size={16}
                            color={isDark ? 'oklch(0.72 0.17 160)' : 'oklch(0.68 0.18 160)'}
                          />
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
