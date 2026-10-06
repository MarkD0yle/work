import { OptionCard, SelectField, TextField, TextareaField } from "../forms";
import type { Errors, OrderConfig } from "./model";

/* The three form sections, body only. Containers supply the titles/chrome
 * (stacked cards, panel sections, collapsibles, anchored sections) so the
 * fields behave identically in every variant. Radios that reveal extra
 * inputs: creation mode, redemption mode, per-customer limit. */

type SectionProps = {
  value: OrderConfig;
  errors: Errors;
  onChange: (patch: Partial<OrderConfig>) => void;
};

function RadioGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="mb-1.5 text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
        {label}
      </div>
      <div className="grid gap-2 @md:grid-cols-3">{children}</div>
    </div>
  );
}

export function BasicInfoBody({ value, errors, onChange }: SectionProps) {
  return (
    <div className="@container space-y-4">
      <TextField
        label="Name"
        required
        value={value.name}
        error={errors.name}
        placeholder="e.g. Spring promotion"
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <TextareaField
        label="Description"
        value={value.description}
        rows={2}
        onChange={(e) => onChange({ description: e.target.value })}
      />
      <RadioGroup label="Status">
        <OptionCard
          selected={value.status === "active"}
          onSelect={() => onChange({ status: "active" })}
          title="Active"
        />
        <OptionCard
          selected={value.status === "inactive"}
          onSelect={() => onChange({ status: "inactive" })}
          title="Inactive"
        />
      </RadioGroup>
    </div>
  );
}

export function CreationBody({ value, errors, onChange }: SectionProps) {
  return (
    <div className="@container space-y-4">
      <RadioGroup label="Creation method">
        <OptionCard
          selected={value.creation === "manual"}
          onSelect={() => onChange({ creation: "manual" })}
          title="Manual"
          description="Created by a person."
        />
        <OptionCard
          selected={value.creation === "scheduled"}
          onSelect={() => onChange({ creation: "scheduled" })}
          title="Scheduled"
          description="Created on a timer."
        />
        <OptionCard
          selected={value.creation === "api"}
          onSelect={() => onChange({ creation: "api" })}
          title="API"
          description="Created by a system."
        />
      </RadioGroup>

      {value.creation === "scheduled" && (
        <div className="grid gap-4 @md:grid-cols-2">
          <SelectField
            label="Frequency"
            value={value.frequency}
            onChange={(e) =>
              onChange({ frequency: e.target.value as OrderConfig["frequency"] })
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </SelectField>
          <TextField
            label="Time"
            type="time"
            required
            value={value.time}
            error={errors.time}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </div>
      )}

      {value.creation === "api" && (
        <TextField
          label="Endpoint URL"
          required
          value={value.endpoint}
          error={errors.endpoint}
          placeholder="https://"
          onChange={(e) => onChange({ endpoint: e.target.value })}
        />
      )}
    </div>
  );
}

export function RedemptionBody({ value, errors, onChange }: SectionProps) {
  return (
    <div className="@container space-y-4">
      <RadioGroup label="Redeemable">
        <OptionCard
          selected={value.redemption === "immediate"}
          onSelect={() => onChange({ redemption: "immediate" })}
          title="Immediately"
        />
        <OptionCard
          selected={value.redemption === "delayed"}
          onSelect={() => onChange({ redemption: "delayed" })}
          title="After a delay"
        />
        <OptionCard
          selected={value.redemption === "window"}
          onSelect={() => onChange({ redemption: "window" })}
          title="In a window"
        />
      </RadioGroup>

      {value.redemption === "delayed" && (
        <TextField
          label="Delay (days)"
          type="number"
          min={1}
          required
          value={value.delayDays}
          error={errors.delayDays}
          onChange={(e) => onChange({ delayDays: e.target.value })}
        />
      )}

      {value.redemption === "window" && (
        <div className="grid gap-4 @md:grid-cols-2">
          <TextField
            label="Start date"
            type="date"
            required
            value={value.windowStart}
            error={errors.windowStart}
            onChange={(e) => onChange({ windowStart: e.target.value })}
          />
          <TextField
            label="End date"
            type="date"
            required
            value={value.windowEnd}
            error={errors.windowEnd}
            onChange={(e) => onChange({ windowEnd: e.target.value })}
          />
        </div>
      )}

      <RadioGroup label="Limit per customer">
        <OptionCard
          selected={value.limit === "unlimited"}
          onSelect={() => onChange({ limit: "unlimited" })}
          title="Unlimited"
        />
        <OptionCard
          selected={value.limit === "limited"}
          onSelect={() => onChange({ limit: "limited" })}
          title="Limited"
        />
      </RadioGroup>

      {value.limit === "limited" && (
        <TextField
          label="Max redemptions"
          type="number"
          min={1}
          required
          value={value.limitCount}
          error={errors.limitCount}
          onChange={(e) => onChange({ limitCount: e.target.value })}
        />
      )}
    </div>
  );
}
