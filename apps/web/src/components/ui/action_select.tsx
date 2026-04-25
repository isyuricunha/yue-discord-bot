import { Select } from './select'
import { describe_action } from '../../lib/automod'

interface ActionSelectProps {
    value: string
    onValueChange: (value: string) => void
    disabled?: boolean
    showDescription?: boolean
    className?: string
}

export function ActionSelect({ value, onValueChange, disabled, showDescription = true, className }: ActionSelectProps) {
    return (
        <div className={className}>
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <option value="delete">Deletar</option>
                <option value="warn">Avisar</option>
                <option value="mute">Silenciar</option>
                <option value="kick">Expulsar</option>
                <option value="ban">Banir</option>
            </Select>
            {showDescription && (
                <div className="mt-2 text-xs text-muted-foreground">{describe_action(value)}</div>
            )}
        </div>
    )
}
