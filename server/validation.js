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

const register = z.object({
  name: text(100, 2),
  email,
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').max(128),
  phone,
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

module.exports = { register, login, quote, lead, adminUpdate, page, id, body };
