import { NextResponse, type NextRequest } from 'next/server'
import locales from '@/constant/locales'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || ''
const NEXT_PUBLIC_BUILD_MODE = process.env.NEXT_PUBLIC_BUILD_MODE || 'default'
const NEXT_PUBLIC_GEMINI_MODEL_LIST = process.env.NEXT_PUBLIC_GEMINI_MODEL_LIST || 'all'
const NEXT_PUBLIC_UPLOAD_LIMIT = Number(process.env.NEXT_PUBLIC_UPLOAD_LIMIT || '0')
const DEFAULT_LOCALE = 'en-US'
const SUPPORTED_LOCALES = new Set(Object.keys(locales))

const COUNTRY_TO_LOCALE: Record<string, string> = {
  AE: 'ar-SA',
  AR: 'es-ES',
  AT: 'de-DE',
  AU: 'en-US',
  BE: 'fr-FR',
  BH: 'ar-SA',
  BO: 'es-ES',
  BR: 'pt-BR',
  BY: 'ru-RU',
  CA: 'en-US',
  CH: 'de-DE',
  CL: 'es-ES',
  CN: 'zh-CN',
  CO: 'es-ES',
  CR: 'es-ES',
  CU: 'es-ES',
  CY: 'en-US',
  DE: 'de-DE',
  DO: 'es-ES',
  DZ: 'ar-SA',
  EC: 'es-ES',
  EG: 'ar-SA',
  ES: 'es-ES',
  FR: 'fr-FR',
  GB: 'en-US',
  GT: 'es-ES',
  HK: 'zh-TW',
  HN: 'es-ES',
  IE: 'en-US',
  IQ: 'ar-SA',
  IT: 'en-US',
  JO: 'ar-SA',
  JP: 'ja-JP',
  KR: 'ko-KR',
  KW: 'ar-SA',
  LB: 'ar-SA',
  LU: 'fr-FR',
  LY: 'ar-SA',
  MA: 'ar-SA',
  MC: 'fr-FR',
  MO: 'zh-TW',
  MX: 'es-ES',
  NI: 'es-ES',
  NZ: 'en-US',
  OM: 'ar-SA',
  PA: 'es-ES',
  PE: 'es-ES',
  PR: 'es-ES',
  PT: 'pt-BR',
  PY: 'es-ES',
  QA: 'ar-SA',
  RU: 'ru-RU',
  SA: 'ar-SA',
  SG: 'zh-CN',
  SV: 'es-ES',
  SY: 'ar-SA',
  TN: 'ar-SA',
  TW: 'zh-TW',
  US: 'en-US',
  UY: 'es-ES',
  VE: 'es-ES',
  YE: 'ar-SA',
}

function getCountryCode(req: NextRequest) {
  const countryHeaders = [
    'cf-ipcountry',
    'x-vercel-ip-country',
    'x-country-code',
    'x-country',
    'cloudfront-viewer-country',
  ]
  for (const headerName of countryHeaders) {
    const value = req.headers.get(headerName)?.toUpperCase().trim()
    if (value && /^[A-Z]{2}$/.test(value) && value !== 'XX' && value !== 'T1') {
      return value
    }
  }
  return ''
}

function getLocaleFromCountry(countryCode: string) {
  const locale = COUNTRY_TO_LOCALE[countryCode] || DEFAULT_LOCALE
  return SUPPORTED_LOCALES.has(locale) ? locale : DEFAULT_LOCALE
}

export const runtime = 'edge'
export const preferredRegion = ['cle1', 'iad1', 'pdx1', 'sfo1', 'sin1', 'syd1', 'hnd1', 'kix1']

export async function GET(req: NextRequest) {
  if (NEXT_PUBLIC_BUILD_MODE === 'export') return new NextResponse('Not available under static deployment')
  const countryCode = getCountryCode(req)
  const localeFromIp = getLocaleFromCountry(countryCode)

  return NextResponse.json({
    isProtected: GEMINI_API_KEY !== '' && ACCESS_PASSWORD !== '',
    buildMode: NEXT_PUBLIC_BUILD_MODE,
    modelList: NEXT_PUBLIC_GEMINI_MODEL_LIST,
    uploadLimit: NEXT_PUBLIC_UPLOAD_LIMIT,
    countryCode,
    localeFromIp,
  })
}
