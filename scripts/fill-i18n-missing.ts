#!/usr/bin/env bun
/**
 * Fill missing i18n keys in all locales.
 * - New keys (devices.*, projects.*, credits.*) get proper translations.
 * - All other missing keys get English values as baseline.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(import.meta.dir, "..", "apps/app/src/i18n/locales");
const enContent = readFileSync(join(LOCALES_DIR, "en.ts"), "utf-8");

// Parse en.ts to extract all keys and values
const enEntries = new Map<string, string>();
for (const line of enContent.split("\n")) {
  const match = line.match(/^\s*"([^"]+)":\s*"(.*)",?\s*$/);
  if (match) {
    enEntries.set(match[1], match[2]);
  }
}

console.log(`English has ${enEntries.size} keys`);

// Proper translations for new keys (devices, projects, credits) in each locale
const translations: Record<string, Record<string, string>> = {
  ja: {
    "devices.section_title": "マルチデバイス",
    "devices.section_desc": "モバイルデバイスのリモート接続と制御を有効化。",
    "devices.allow_mobile": "モバイル接続を許可",
    "devices.allow_mobile_desc": "モバイルデバイスのペアリングを有効にしてリモートセッション制御を行います。",
    "devices.pair_new_device": "新しいデバイスをペアリング",
    "devices.pair_new_device_desc": "ペアリングコードを生成してモバイルデバイスに入力します。",
    "devices.generate_pair_code": "ペアリングコードを生成",
    "devices.expires_in": "{seconds}秒で期限切れ",
    "devices.pair_code_hint": "OpenWorkモバイルアプリを開き、このコードを入力してデバイスをペアリングします。",
    "devices.paired_devices": "ペアリング済みデバイス",
    "devices.paired_count_one": "{count}台のデバイスがペアリング済み",
    "devices.paired_count_other": "{count}台のデバイスがペアリング済み",
    "devices.revoke": "{name}のペアリングを解除",
    "devices.never_seen": "未接続",
    "devices.just_now": "たった今",
    "devices.minutes_ago_one": "{count}分前",
    "devices.minutes_ago_other": "{count}分前",
    "devices.hours_ago_one": "{count}時間前",
    "devices.hours_ago_other": "{count}時間前",
    "devices.remote_active": "リモート操作中",
    "devices.locked_title": "ワークスペースがロックされています",
    "devices.locked_desc": "リモートデバイスからロックされました。ローカル操作はロック解除まで無効です。",
    "devices.unlock_locally": "ローカルでロック解除",
    "credits.section_title": "クレジット",
    "credits.section_desc": "AIクレジット残高とサブスクリプション階層を管理。",
    "credits.sign_in_required": "サインインが必要",
    "credits.sign_in_required_desc": "OpenWork Denにサインインしてクレジットを管理。",
    "credits.balance_title": "現在の残高",
    "credits.tier_label": "階層：{tier}",
    "credits.points": "クレジット",
    "credits.total_purchased_one": "{count}購入済み",
    "credits.total_purchased_other": "{count}購入済み",
    "credits.total_consumed_one": "{count}消費済み",
    "credits.total_consumed_other": "{count}消費済み",
    "credits.multiplier": "倍率：{value}x",
    "credits.tier_free": "無料",
    "credits.tier_pro": "プロ",
    "credits.tier_enterprise": "エンタープライズ",
    "credits.tier_select_title": "サブスクリプション階層",
    "credits.tier_select_desc": "上位階層は操作あたりのクレジット消費を削減します。",
    "credits.purchase_title": "クレジット購入",
    "credits.purchase_desc": "組織残高にクレジットを追加。",
    "credits.purchase_button": "購入",
    "credits.transactions_title": "最近の取引",
    "credits.transactions_count_one": "{count}件の取引",
    "credits.transactions_count_other": "{count}件の取引",
    "credits.tx_purchase": "購入",
    "credits.tx_consumption": "消費",
    "credits.tx_refund": "返金",
    "credits.tx_grant": "付与",
    "projects.templates_title": "プロジェクトテンプレート",
    "projects.templates_desc": "テンプレートから新しいプロジェクトを作成。",
    "projects.capacity_title": "ストレージ容量",
    "projects.capacity_desc": "プロジェクトのストレージ使用量（5GB上限）。",
    "projects.invites_title": "招待",
    "projects.invites_desc": "メンバーをプロジェクトに招待。",
    "projects.invite_approve": "承認",
    "projects.invite_reject": "拒否",
    "projects.task_transfer_title": "タスク引き継ぎ",
    "projects.task_transfer_desc": "タスクを別のメンバーに引き継ぎ。",
  },
  fr: {
    "devices.section_title": "Multi-appareils",
    "devices.section_desc": "Autoriser les appareils mobiles à se connecter et contrôler cet espace à distance.",
    "devices.allow_mobile": "Autoriser la connexion mobile",
    "devices.allow_mobile_desc": "Activer le couplage avec des appareils mobiles pour le contrôle de session à distance.",
    "devices.pair_new_device": "Coupler un nouvel appareil",
    "devices.pair_new_device_desc": "Générer un code de couplage et le saisir sur votre appareil mobile.",
    "devices.generate_pair_code": "Générer le code",
    "devices.expires_in": "Expire dans {seconds}s",
    "devices.pair_code_hint": "Ouvrez l'app mobile OpenWork et saisissez ce code pour coupler votre appareil.",
    "devices.paired_devices": "Appareils couplés",
    "devices.paired_count_one": "{count} appareil couplé",
    "devices.paired_count_other": "{count} appareils couplés",
    "devices.revoke": "Découpler {name}",
    "devices.never_seen": "Jamais vu",
    "devices.just_now": "À l'instant",
    "devices.minutes_ago_one": "Il y a {count} minute",
    "devices.minutes_ago_other": "Il y a {count} minutes",
    "devices.hours_ago_one": "Il y a {count} heure",
    "devices.hours_ago_other": "Il y a {count} heures",
    "devices.remote_active": "Contrôle distant actif",
    "devices.locked_title": "Espace verrouillé",
    "devices.locked_desc": "Cet espace a été verrouillé depuis un appareil distant. Les interactions locales sont désactivées jusqu'au déverrouillage.",
    "devices.unlock_locally": "Déverrouiller localement",
    "credits.section_title": "Crédits",
    "credits.section_desc": "Gérer votre solde de crédits IA et votre niveau d'abonnement.",
    "credits.sign_in_required": "Connexion requise",
    "credits.sign_in_required_desc": "Connectez-vous à OpenWork Den pour gérer les crédits.",
    "credits.balance_title": "Solde actuel",
    "credits.tier_label": "Niveau : {tier}",
    "credits.points": "crédits",
    "credits.total_purchased_one": "{count} acheté",
    "credits.total_purchased_other": "{count} achetés",
    "credits.total_consumed_one": "{count} consommé",
    "credits.total_consumed_other": "{count} consommés",
    "credits.multiplier": "Multiplicateur : {value}x",
    "credits.tier_free": "Gratuit",
    "credits.tier_pro": "Pro",
    "credits.tier_enterprise": "Entreprise",
    "credits.tier_select_title": "Niveau d'abonnement",
    "credits.tier_select_desc": "Les niveaux supérieurs réduisent la consommation de crédits par opération.",
    "credits.purchase_title": "Acheter des crédits",
    "credits.purchase_desc": "Ajouter des crédits au solde de votre organisation.",
    "credits.purchase_button": "Acheter",
    "credits.transactions_title": "Transactions récentes",
    "credits.transactions_count_one": "{count} transaction",
    "credits.transactions_count_other": "{count} transactions",
    "credits.tx_purchase": "Achat",
    "credits.tx_consumption": "Consommation",
    "credits.tx_refund": "Remboursement",
    "credits.tx_grant": "Octroi",
    "projects.templates_title": "Modèles de projet",
    "projects.templates_desc": "Créer un nouveau projet à partir d'un modèle.",
    "projects.capacity_title": "Capacité de stockage",
    "projects.capacity_desc": "Utilisation du stockage du projet (limite 5 Go).",
    "projects.invites_title": "Invitations",
    "projects.invites_desc": "Inviter des membres au projet.",
    "projects.invite_approve": "Approuver",
    "projects.invite_reject": "Rejeter",
    "projects.task_transfer_title": "Transfert de tâche",
    "projects.task_transfer_desc": "Transférer une tâche à un autre membre.",
  },
  es: {
    "devices.section_title": "Multi-dispositivo",
    "devices.section_desc": "Permitir que dispositivos móviles se conecten y controlen este espacio remotamente.",
    "devices.allow_mobile": "Permitir conexión móvil",
    "devices.allow_mobile_desc": "Habilitar emparejamiento con dispositivos móviles para control remoto de sesión.",
    "devices.pair_new_device": "Emparejar nuevo dispositivo",
    "devices.pair_new_device_desc": "Generar código de emparejamiento e ingresarlo en su dispositivo móvil.",
    "devices.generate_pair_code": "Generar código",
    "devices.expires_in": "Expira en {seconds}s",
    "devices.pair_code_hint": "Abra la app móvil OpenWork e ingrese este código para emparejar su dispositivo.",
    "devices.paired_devices": "Dispositivos emparejados",
    "devices.paired_count_one": "{count} dispositivo emparejado",
    "devices.paired_count_other": "{count} dispositivos emparejados",
    "devices.revoke": "Desemparejar {name}",
    "devices.never_seen": "Nunca visto",
    "devices.just_now": "Justo ahora",
    "devices.minutes_ago_one": "Hace {count} minuto",
    "devices.minutes_ago_other": "Hace {count} minutos",
    "devices.hours_ago_one": "Hace {count} hora",
    "devices.hours_ago_other": "Hace {count} horas",
    "devices.remote_active": "Control remoto activo",
    "devices.locked_title": "Espacio bloqueado",
    "devices.locked_desc": "Este espacio fue bloqueado desde un dispositivo remoto. Las interacciones locales están deshabilitadas hasta el desbloqueo.",
    "devices.unlock_locally": "Desbloquear localmente",
    "credits.section_title": "Créditos",
    "credits.section_desc": "Administre su saldo de créditos IA y nivel de suscripción.",
    "credits.sign_in_required": "Inicio de sesión requerido",
    "credits.sign_in_required_desc": "Inicie sesión en OpenWork Den para ver y administrar créditos.",
    "credits.balance_title": "Saldo actual",
    "credits.tier_label": "Nivel: {tier}",
    "credits.points": "créditos",
    "credits.total_purchased_one": "{count} comprado",
    "credits.total_purchased_other": "{count} comprados",
    "credits.total_consumed_one": "{count} consumido",
    "credits.total_consumed_other": "{count} consumidos",
    "credits.multiplier": "Multiplicador: {value}x",
    "credits.tier_free": "Gratis",
    "credits.tier_pro": "Pro",
    "credits.tier_enterprise": "Empresa",
    "credits.tier_select_title": "Nivel de suscripción",
    "credits.tier_select_desc": "Los niveles superiores reducen el consumo de créditos por operación.",
    "credits.purchase_title": "Comprar créditos",
    "credits.purchase_desc": "Agregar créditos al saldo de su organización.",
    "credits.purchase_button": "Comprar",
    "credits.transactions_title": "Transacciones recientes",
    "credits.transactions_count_one": "{count} transacción",
    "credits.transactions_count_other": "{count} transacciones",
    "credits.tx_purchase": "Compra",
    "credits.tx_consumption": "Consumo",
    "credits.tx_refund": "Reembolso",
    "credits.tx_grant": "Concesión",
    "projects.templates_title": "Plantillas de proyecto",
    "projects.templates_desc": "Crear un nuevo proyecto desde una plantilla.",
    "projects.capacity_title": "Capacidad de almacenamiento",
    "projects.capacity_desc": "Uso de almacenamiento del proyecto (límite 5 GB).",
    "projects.invites_title": "Invitaciones",
    "projects.invites_desc": "Invitar miembros al proyecto.",
    "projects.invite_approve": "Aprobar",
    "projects.invite_reject": "Rechazar",
    "projects.task_transfer_title": "Transferencia de tarea",
    "projects.task_transfer_desc": "Transferir una tarea a otro miembro.",
  },
};

const LOCALES = ["ca", "es", "fr", "ja", "pt-BR", "ru", "th", "vi"];

for (const locale of LOCALES) {
  const filePath = join(LOCALES_DIR, `${locale}.ts`);
  const content = readFileSync(filePath, "utf-8");

  // Parse existing keys
  const existingKeys = new Set<string>();
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*"([^"]+)":/);
    if (match) existingKeys.add(match[1]);
  }

  // Find missing keys
  const missing: string[] = [];
  for (const key of enEntries.keys()) {
    if (!existingKeys.has(key)) missing.push(key);
  }

  if (missing.length === 0) {
    console.log(`${locale}: complete (${existingKeys.size} keys)`);
    continue;
  }

  // Build new entries
  const lines: string[] = [];
  const properTranslations = translations[locale] ?? {};
  for (const key of missing) {
    const value = properTranslations[key] ?? enEntries.get(key)!;
    lines.push(`  "${key}": "${value}",`);
  }

  // Insert before the closing brace
  const insertText = lines.join("\n") + "\n";
  const updatedContent = content.replace(/\n} as const;\s*$/, "\n" + insertText + "} as const;\n");

  writeFileSync(filePath, updatedContent, "utf-8");
  const properCount = missing.filter((k) => properTranslations[k]).length;
  console.log(`${locale}: added ${missing.length} keys (${properCount} proper translations, ${missing.length - properCount} English fallback)`);
}