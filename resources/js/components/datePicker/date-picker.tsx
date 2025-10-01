import * as React from "react";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import InputError from "@/components/input-error";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
type Props = {
    id?: string;
    name?: string;
    label?: string;
    value: string | null;                 // 'YYYY-MM-DD' or null
    onChange: (value: string | null) => void;
    error?: string;
    placeholder?: string;                 // default: 'Select date'
    resetLabel?: string;                  // default: 'Reset'
    disabled?: boolean;
    className?: string;                   // wrapper
    buttonClassName?: string;             // main button classes
    showReset?: boolean;                  // default: true
};

export function DatePickerField({
    id = "date",
    name,
    label,
    value,
    onChange,
    error,
    placeholder = "Select date",
    resetLabel = "Reset",
    disabled,
    className,
    buttonClassName,
    showReset = true,
}: Props) {
    const [open, setOpen] = React.useState(false);

    // Convert string 'YYYY-MM-DD' -> Date at local noon to avoid TZ rollback
    const selectedDate = React.useMemo(
        () => (value ? new Date(`${value}T12:00:00`) : undefined),
        [value]
    );

    return (
        <div className={cn?.("grid gap-2", className) ?? `grid gap-2`}>
            {label && (
                <Label htmlFor={id} className="px-1">
                    {label}
                </Label>
            )}
            {error && <InputError message={error} />}

            <Popover open={open} onOpenChange={setOpen}>
                <div className="flex gap-2">
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            id={id}
                            name={name}
                            disabled={disabled}
                            className={cn?.("w-48 justify-between font-normal", buttonClassName) ?? "w-48 justify-between font-normal"}
                        >
                            {value ? format(value, "yyyy-MM-dd") : placeholder}
                            <ChevronDownIcon />
                        </Button>
                    </PopoverTrigger>

                    {showReset && (
                        <Button
                            type="button"
                            disabled={disabled}
                            className="w-24 justify-between font-normal"
                            variant="destructive"
                            onClick={() => onChange(null)}
                        >
                            {resetLabel}
                        </Button>
                    )}
                </div>

                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        selected={selectedDate}
                        onSelect={(picked) => {
                            onChange(picked ? format(picked, "yyyy-MM-dd") : null);
                            setOpen(false);
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
