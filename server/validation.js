const { z } = require('zod');
const catalog = require('./catalog');

// Mensajes claros en español para cualquier error que no tenga uno propio.
z.config({
  customError: iss => {
    switch (iss.code) {
      case 'invalid_value': return 'Elija una opción de la lista';
      case 'invalid_type': return iss.input === undefined || iss.input === null ? 'Este campo es obligatorio' : 'Valor inválido';
      case 'too_small':
        if (iss.origin === 'string') return iss.minimum <= 1 ? 'Este campo es obligatorio' : `Escriba al menos ${iss.minimum} caracteres`;
        return `Debe ser al menos ${iss.minimum}`;
      case 'too_big':
        if (iss.origin === 'string') return iss.maximum === 0 ? 'Este campo debe quedar vacío' : `Máximo ${iss.maximum} caracteres`;
        return `Debe ser como máximo ${iss.maximum}`;
      case 'invalid_format': return iss.format === 'email' ? 'Escriba un correo válido' : 'Formato inválido';
      default: return 'Valor inválido';
    }
  },
});

const text = (max, min = 1) => z.string().trim().min(min).max(max);
const optionalText = max => z.string().trim().max(max).optional().transform(v => (v ? v : null));
const oneOf = list => z.enum(catalog.ids(list));
const email = z.string().trim().toLowerCase().email().max(254);
const phone = z.string().trim().max(30).regex(/^[0-9+()\-.\s]*$/, 'Teléfono inválido').optional().transform(v => (v ? v : null));
const zip = z.string().trim().regex(/^\d{5}$/, 'Código postal de 5 dígitos');

// Casillas y valores sí/no que llegan como true, 'true', 'on' o '1'.
const yes = z.union([z.boolean(), z.string()]).optional().transform(v => v === true || v === 'true' || v === 'on' || v === '1');
const zipList = z.string().trim().max(400).regex(/^[0-9,\s]*$/, 'Escriba códigos postales separados por comas').optional()
  .transform(v => (v ? v.split(/[\s,]+/).filter(z5 => /^\d{5}$/.test(z5)).slice(0, 60).join(',') || null : null));

const register = z.object({
  name: text(100, 2),
  email,
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').max(128),
  phone,
  role: z.enum(['client', 'funder']).optional().default('client'),
  org_name: optionalText(120),
  kind: z.enum(catalog.ids(catalog.funderKinds)).optional(),
}).superRefine((d, ctx) => {
  if (d.role === 'funder') {
    if (!d.org_name || d.org_name.length < 2) ctx.addIssue({ code: 'custom', path: ['org_name'], message: 'Escriba el nombre de la organización o su nombre' });
    if (!d.kind) ctx.addIssue({ code: 'custom', path: ['kind'], message: 'Elija qué tipo de financiador es' });
  }
});

const funderProfile = z.object({
  org_name: text(120, 2),
  kind: oneOf(catalog.funderKinds),
  zips: zipList,
  max_amount: z.union([z.literal(''), z.coerce.number().int().min(0).max(1000000)]).optional().transform(v => (v === '' || v === undefined ? null : v)),
  housing: z.array(oneOf(catalog.housing)).max(10).optional().transform(v => (v && v.length ? v.join(',') : null)),
  about: optionalText(1000),
});

const offer = z.object({
  amount: z.coerce.number().int().min(50, 'El monto mínimo es 50 dólares').max(1000000),
  coverage: oneOf(catalog.coverages),
  message: optionalText(1000),
});

const login = z.object({
  email,
  password: z.string().min(1).max(128),
});

const quote = z.object({
  product: oneOf(catalog.products),
  finish: oneOf(catalog.finishes),
  rise_in: z.coerce.number().int().min(1).max(120),
  address: text(200, 5),
  zip,
  housing: oneOf(catalog.housing),
  mobility: oneOf(catalog.mobility),
  contact_pref: oneOf(catalog.contactPrefs),
  notes: optionalText(2000),
  low_income: yes,
  veteran: yes,
  medicaid: yes,
  share_consent: yes,
});

const lead = z.object({
  name: text(100, 2),
  email,
  phone,
  zip: z.string().trim().regex(/^(\d{5})?$/).optional().transform(v => (v ? v : null)),
  message: text(2000, 5),
  website: z.string().max(0).optional(), // campo trampa contra bots; debe llegar vacío
});

const adminUpdate = z.object({
  status: oneOf(catalog.statuses),
  admin_note: optionalText(2000),
});

const page = z.coerce.number().int().min(1).max(1000).catch(1);
const id = z.coerce.number().int().positive();

// Middleware: valida req.body con el esquema y deja el resultado limpio en req.data.
function body(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] || 'form';
        if (!fields[key]) fields[key] = issue.message;
      }
      return res.status(400).json({ error: 'Revise los datos del formulario.', fields });
    }
    req.data = result.data;
    next();
  };
}

module.exports = { register, login, quote, lead, adminUpdate, funderProfile, offer, page, id, body };
