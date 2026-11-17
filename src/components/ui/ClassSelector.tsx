import React, { useEffect, useState } from 'react';
import { KC_CLASSES } from '@/src/config/brand';

interface ClassSelectorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputClassName?: string;
}

const KC_CLASS_SET = new Set<string>(KC_CLASSES);
const OTHER_VALUE = '__other__';

export const ClassSelector: React.FC<ClassSelectorProps> = ({
  id,
  value,
  onChange,
  required = false,
  inputClassName = 'w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2',
}) => {
  const [customMode, setCustomMode] = useState<boolean>(
    () => Boolean(value.trim() && !KC_CLASS_SET.has(value.trim()))
  );

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed && !KC_CLASS_SET.has(trimmed)) {
      setCustomMode(true);
    } else if (KC_CLASS_SET.has(trimmed)) {
      setCustomMode(false);
    }
  }, [value]);

  const selectValue = customMode
    ? OTHER_VALUE
    : KC_CLASS_SET.has(value.trim())
    ? value.trim()
    : '';

  return (
    <div className="space-y-2">
      <select
        id={id}
        required={required && !customMode}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER_VALUE) {
            setCustomMode(true);
            if (KC_CLASS_SET.has(value.trim())) {
              onChange('');
            }
          } else {
            setCustomMode(false);
            onChange(next);
          }
        }}
        className={inputClassName}
      >
        <option value="" disabled>
          Select class…
        </option>
        {KC_CLASSES.map((cls) => (
          <option key={cls} value={cls}>
            {cls}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other (specify class / section)</option>
      </select>

      {customMode && (
        <div>
          <label htmlFor={`${id}-custom`} className="sr-only">
            Custom class or form name
          </label>
          <input
            id={`${id}-custom`}
            type="text"
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Specify class (e.g. 4 Macdonald, L6 Science)"
            maxLength={40}
            className={inputClassName}
          />
        </div>
      )}
    </div>
  );
};
