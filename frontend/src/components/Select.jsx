import * as React from "react"
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

/**
 * @param {Object} props
 * @param {any} props.value
 * @param {Function} props.onChange
 * @param {Array<{value: any, label: React.ReactNode, disabled?: boolean}>} props.options
 * @param {string} [props.className]
 */
export default function Select({ value, onChange, options, className = '' }) {
  const stringValue = value !== undefined && value !== null ? String(value) : ""

  const handleValueChange = (val) => {
    const matchedOption = options.find(opt => String(opt.value) === val)
    if (matchedOption) {
      onChange(matchedOption.value)
    } else {
      onChange(val)
    }
  }

  return (
    <div className={`min-w-0 w-full ${className}`}>
      <ShadcnSelect value={stringValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full bg-zinc-900/30 border-zinc-800 text-zinc-200 text-sm h-10 px-4">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent position="popper" className="bg-zinc-900/95 border-zinc-800 text-zinc-100 shadow-xl max-h-60 z-50">
          {options.map((option, idx) => (
            <SelectItem 
              key={idx} 
              value={String(option.value)}
              disabled={option.disabled}
              className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
    </div>
  )
}
