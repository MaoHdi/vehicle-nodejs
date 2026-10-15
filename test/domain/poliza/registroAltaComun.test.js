'use strict'

const {
  llenarContactos,
  llenarPersona,
  llenarRespuesta,
  CONTACTO_TOMADOR,
  POS_TOMADOR,
  POS_BENEFICIARIO
} = require('../../../src/domain/poliza/registroAltaComun')

describe('registroAltaComun - llenarContactos', () => {
  it('ubica fijo, movil y correo en sus posiciones e ignora otros tipos', () => {
    const datos = new Map()
    llenarContactos(
      datos,
      [
        { tipoContacto: { codigo: '1' }, textoContacto: '6010000000' },
        { tipoContacto: { codigo: '6' }, textoContacto: '3000000000' },
        { tipoContacto: { codigo: '3' }, textoContacto: 'prueba@ejemplo.test' },
        { tipoContacto: { codigo: '9' }, textoContacto: 'otro' },
        {}
      ],
      CONTACTO_TOMADOR
    )

    expect(datos.get(16)).toBe('6010000000')
    expect(datos.get(17)).toBe('3000000000')
    expect(datos.get(18)).toBe('prueba@ejemplo.test')
    expect(datos.size).toBe(3)
  })

  it('acepta un unico contacto y movil con codigo 5', () => {
    const datos = new Map()
    llenarContactos(datos, { tipoContacto: { codigo: 5 }, textoContacto: '3100000000' }, CONTACTO_TOMADOR)

    expect(datos.get(17)).toBe('3100000000')
  })
})

describe('registroAltaComun - llenarPersona', () => {
  it('llena los datos de persona natural', () => {
    const datos = new Map([[5, 'N']])
    const origen = {
      persona: {
        personaNatural: {
          primerApellido: 'APELLIDO',
          primerNombre: 'NOMBRE',
          genero: { codigo: '2' },
          fechaNacimiento: '1990-01-15',
          ocupacion: { codigo: '7' },
          estadoCivil: { codigo: 'S' }
        }
      }
    }

    expect(llenarPersona(datos, origen, 'persona.', POS_TOMADOR, 5, 'msg_error_tipo_persona')).toBe('')
    expect(datos.get(7)).toBe('APELLIDO')
    expect(datos.get(9)).toBe('NOMBRE')
    expect(datos.get(11)).toBe('F')
    expect(datos.get(14)).toBe('170')
    expect(datos.get(19)).toBe('7')
    expect(datos.get(20)).toBe('S')
  })

  it('no informa pais cuando la posicion no existe', () => {
    const datos = new Map([[1, 'N']])

    llenarPersona(datos, { personaNatural: {} }, '', POS_BENEFICIARIO, 1, 'x')

    expect([...datos.values()]).not.toContain('170')
  })

  it('llena la razon social de persona juridica', () => {
    const datos = new Map([[5, 'J']])

    const error = llenarPersona(datos, { personaJuridica: { razonSocial: 'EMPRESA SAS' } }, '', POS_TOMADOR, 5, 'x')

    expect(error).toBe('')
    expect(datos.get(7)).toBe('EMPRESA SAS')
    expect(datos.get(9)).toBe('EMPRESA SAS')
  })

  it('devuelve el mensaje de error con un tipo de persona desconocido', () => {
    const { messages } = require('../../../src/config/properties')
    const clave = Object.keys(messages).find((k) => typeof messages[k] === 'string' && !k.startsWith('_'))

    expect(llenarPersona(new Map([[5, 'X']]), {}, '', POS_TOMADOR, 5, clave)).toBe(messages[clave])
  })
})

describe('registroAltaComun - llenarRespuesta', () => {
  it('prefiere el codigo sobre el valor', () => {
    const datos = new Map()
    llenarRespuesta(datos, { codigo: 'S', valor: '10' }, 3)
    expect(datos.get(3)).toBe('S')
  })

  it('usa el valor cuando no hay codigo', () => {
    const datos = new Map()
    llenarRespuesta(datos, { valor: '10' }, 3)
    llenarRespuesta(datos, undefined, 4)
    expect(datos.get(3)).toBe('10')
    expect(datos.has(4)).toBe(false)
  })
})
