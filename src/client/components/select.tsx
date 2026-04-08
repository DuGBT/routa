"use client";

import { type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string | number | ReactNode;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange" | "size"> {
  value?: string | number | readonly string[];
  onValueChange?: (value: string) => void;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  options?: SelectOption[];
  optionGroups?: SelectOptionGroup[];
  placeholder?: string;
}

export function Select({
  value,
  onValueChange,
  onChange,
  options,
  optionGroups,
  placeholder,
  className,
  disabled,
  children,
  id,
  name,
  ...rest
}: SelectProps) {
  const currentValue = value === "" || value === undefined ? undefined : String(value);

  const handleChange = (val: string | null) => {
    if (val === null) return;
    onValueChange?.(val);
    if (onChange) {
      const syntheticEvent = { target: { value: val } } as ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  // If children are provided (raw <option> elements), fall back to native <select>
  // for backward compatibility
  if (children) {
    return (
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        className={cn(
          "w-full border border-input bg-transparent rounded-md px-2.5 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onChange={onChange}
        {...rest}
      >
        {children}
      </select>
    );
  }

  return (
    <ShadcnSelect value={currentValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn(className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {optionGroups?.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.options.map((item) => (
              <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        {options?.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </ShadcnSelect>
  );
}
