import { useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const PASSWORD_MIN = 8;

export function validatePassword(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `Mínimo ${PASSWORD_MIN} caracteres`;
  if (!/[A-Z]/.test(p)) return "Debe incluir al menos 1 mayúscula";
  if (!/[0-9]/.test(p)) return "Debe incluir al menos 1 número";
  return null;
}

function strength(p: string): { score: number; label: string; color: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const map = [
    { label: "Muy débil", color: "bg-destructive" },
    { label: "Débil", color: "bg-destructive" },
    { label: "Aceptable", color: "bg-amber-500" },
    { label: "Buena", color: "bg-amber-500" },
    { label: "Fuerte", color: "bg-emerald-500" },
    { label: "Muy fuerte", color: "bg-emerald-600" },
  ];
  return { score: s, ...map[s]! };
}

interface Props {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  showLabels?: boolean;
  idPrefix?: string;
}

export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  showLabels = true,
  idPrefix = "pwd",
}: Props) {
  const [show, setShow] = useState(false);
  const s = useMemo(() => strength(password), [password]);
  const err = password ? validatePassword(password) : null;
  const mismatch = confirm && confirm !== password ? "Las contraseñas no coinciden" : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {showLabels && <Label htmlFor={`${idPrefix}-pw`}>Contraseña</Label>}
        <div className="relative">
          <Input
            id={`${idPrefix}-pw`}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            className="min-h-11 pr-10"
            placeholder="Mín. 8, 1 mayúscula, 1 número"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {password && (
          <div className="space-y-1">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full bg-muted transition-colors",
                    i < s.score && s.color,
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Fortaleza: {s.label}</p>
          </div>
        )}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
      <div className="space-y-1.5">
        {showLabels && <Label htmlFor={`${idPrefix}-confirm`}>Confirmar contraseña</Label>}
        <Input
          id={`${idPrefix}-confirm`}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          className="min-h-11"
        />
        {mismatch && <p className="text-xs text-destructive">{mismatch}</p>}
      </div>
    </div>
  );
}
