import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * @param {Object} props
 * @param {any} props.value
 * @param {Function} props.onChange
 * @param {Array<{value: any, label: React.ReactNode, disabled?: boolean}>} props.options
 * @param {string} [props.className]
 */
export default function Select({ value, onChange, options, className = '' }) {
  const selectedOption = options.find((opt) => opt.value == value) || options[0]

  return (
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={onChange}>
        <Listbox.Button className="relative w-full cursor-pointer py-2.5 pl-4 pr-10 text-left bg-slate-50/50 border border-slate-200/80 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 shadow-sm text-sm text-slate-700 hover:border-slate-300">
          <span className="block truncate font-medium">
            {selectedOption?.label || '请选择'}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white/95 backdrop-blur-md py-1 text-sm shadow-xl shadow-slate-200/50 border border-slate-100 ring-1 ring-black/5 focus:outline-none">
            {options.map((option, idx) => (
              <Listbox.Option
                key={idx}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-2.5 pl-10 pr-4 transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                  }`
                }
                value={option.value}
                disabled={option.disabled}
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${
                        selected ? 'font-bold text-blue-700' : 'font-medium'
                      }`}
                    >
                      {option.label}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                        <Check size={16} aria-hidden="true" strokeWidth={3} />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>
    </div>
  )
}
