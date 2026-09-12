import type { LanguageCode } from "./regions";

const en = {
  "announcement.shipping": "Worldwide sourcing & shipment",
  "announcement.whatsapp": "Personal shopping on WhatsApp",
  "nav.shop": "Shop",
  "nav.all": "All",
  "nav.luxury": "Luxury",
  "nav.personal": "Personal shopping",
  "nav.account": "Account",
  "nav.wishlist": "Wishlist",
  "nav.search": "Search",
  "nav.bag": "Bag",
  "nav.new": "New arrivals",
  "nav.women": "Women",
  "nav.men": "Men",
  "nav.bags": "Bags",
  "nav.shoes": "Shoes",
  "nav.wholesale": "Wholesale",
  "nav.contact": "Contact",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.openBag": "Open bag",
  "nav.items": "items",
  "region.open": "Change region and language",
  "region.title": "Region and language",
  "region.search": "Search country or currency",
  "region.language": "Language",
  "region.close": "Close region and language",
  "region.noResults": "No matching region.",
  "region.auto": "Chosen automatically for your location. You can change this at any time.",
  "region.converted": "Displayed prices use recent reference rates. Final prices are confirmed before payment.",
  "region.unavailable": "Live conversion is temporarily unavailable. Source prices are shown.",
  "common.close": "Close",
  "common.clear": "Clear",
  "common.loading": "Loading",
  "product.priceRequest": "Price on request",
  "product.new": "New",
  "product.requestOnly": "Request only",
  "product.quickRequest": "Quick request",
  "product.quickAdd": "Quick add",
  "product.unavailable": "Unavailable",
  "product.closeSizes": "Close sizes",
  "product.addRequest": "Add request",
  "product.selectOptions": "Select options",
  "product.outOfStock": "Out of stock",
  "product.addBag": "Add to bag",
  "product.selectSize": "Select size",
  "product.requestType": "Request type",
  "product.soldOut": "Sold out",
  "product.related": "You may also like",
  "cart.title": "Your bag",
  "cart.close": "Close cart",
  "cart.subtotal": "Subtotal",
  "cart.confirm": "To be confirmed",
  "cart.checkout": "Checkout via WhatsApp",
  "cart.continue": "Continue shopping",
  "cart.empty": "Your edit is empty.",
  "cart.emptyCopy": "Explore new arrivals or ask Fieldio to source a specific piece.",
  "cart.account": "Have an account?",
  "cart.login": "Log in",
  "cart.faster": "to check out faster.",
  "collection.filter": "Filter & sort",
  "collection.filterTitle": "Filter the edit",
  "collection.brand": "Brand",
  "collection.size": "Size",
  "collection.sort": "Sort",
  "collection.allBrands": "All brands",
  "collection.allSizes": "All sizes",
  "collection.featured": "Featured",
  "collection.name": "Name",
  "collection.low": "Price: low to high",
  "collection.high": "Price: high to low",
  "collection.clear": "Clear filters",
  "collection.piece": "piece",
  "collection.pieces": "pieces",
  "checkout.title": "Complete your request",
  "checkout.notice": "No payment is taken here. Fieldio will confirm availability, shipping, and payment with you on WhatsApp.",
  "checkout.customer": "Customer & delivery",
  "checkout.name": "Full name",
  "checkout.phone": "Phone number",
  "checkout.email": "Email address",
  "checkout.address": "Shipping address",
  "checkout.note": "Note",
  "checkout.optional": "Optional",
  "checkout.consent": "I understand this sends an order request and does not confirm availability or payment.",
  "checkout.continue": "Continue on WhatsApp",
  "checkout.preparing": "Preparing request…",
  "checkout.request": "Your request",
  "checkout.shipping": "Shipping and any sourcing fees are confirmed before payment."
  ,"home.title": "The Fieldio edit",
  "home.intro": "New arrivals, exceptional pieces, and personal sourcing across the brands you want.",
  "home.accountTitle": "Keep your edit close.",
  "home.accountCopy": "Create an account to save your wishlist, details, and order requests, ready whenever you return.",
  "home.createAccount": "Create account",
  "home.signIn": "Already have an account? Sign in",
  "home.luxuryTitle": "A worldwide luxury desk",
  "home.sourceRequest": "Start a sourcing request",
  "home.campaignTitle": "Modern essentials. Chosen with purpose.",
  "home.viewNew": "View new arrivals",
  "home.personalTitle": "Your personal shopper, wherever you are.",
  "home.howItWorks": "How it works",
  "home.chat": "Chat on WhatsApp",
  "account.signInTitle": "Welcome back",
  "account.signUpTitle": "Create your account",
  "account.resetTitle": "Reset your password",
  "account.updateTitle": "Choose a new password",
  "account.intro": "Manage saved details, wishlist, and order requests.",
  "account.google": "Continue with Google",
  "account.emailMethod": "Continue with email",
  "account.emailPassword": "Email and password",
  "account.email": "Email",
  "account.password": "Password",
  "account.signIn": "Sign in",
  "account.create": "Create account",
  "account.forgot": "Forgot password?",
  "account.reset": "Send reset link",
  "account.update": "Update password",
  "account.showPassword": "Show password",
  "account.hidePassword": "Hide password"
} as const;

export type TranslationKey = keyof typeof en;
type Dictionary = Partial<Record<TranslationKey, string>>;

const fr: Dictionary = {
  "announcement.shipping": "Sourcing et expédition dans le monde entier", "announcement.whatsapp": "Shopping personnel sur WhatsApp", "nav.shop": "Boutique", "nav.luxury": "Luxe", "nav.personal": "Shopping personnel", "nav.account": "Compte", "nav.wishlist": "Favoris", "nav.search": "Rechercher", "nav.bag": "Sac", "nav.new": "Nouveautés", "nav.women": "Femme", "nav.men": "Homme", "nav.bags": "Sacs", "nav.shoes": "Chaussures", "nav.wholesale": "Vente en gros", "nav.contact": "Contact", "nav.openMenu": "Ouvrir le menu", "nav.closeMenu": "Fermer le menu", "region.open": "Changer de région et de langue", "region.title": "Région et langue", "region.search": "Rechercher un pays ou une devise", "region.language": "Langue", "region.close": "Fermer la région et la langue", "region.noResults": "Aucune région correspondante.", "region.auto": "Choisi automatiquement selon votre localisation. Vous pouvez le modifier à tout moment.", "region.converted": "Les prix affichés utilisent des taux de référence récents. Le prix final est confirmé avant paiement.", "region.unavailable": "La conversion en direct est momentanément indisponible. Les prix d’origine sont affichés.", "common.close": "Fermer", "common.clear": "Effacer", "common.loading": "Chargement", "product.priceRequest": "Prix sur demande", "product.new": "Nouveau", "product.requestOnly": "Sur demande", "product.quickRequest": "Demande rapide", "product.quickAdd": "Ajout rapide", "product.unavailable": "Indisponible", "product.closeSizes": "Fermer les tailles", "product.addRequest": "Ajouter la demande", "product.selectOptions": "Choisir les options", "product.outOfStock": "Épuisé", "product.addBag": "Ajouter au sac", "product.selectSize": "Choisir la taille", "product.requestType": "Type de demande", "product.soldOut": "Épuisé", "product.related": "Vous aimerez aussi", "cart.title": "Votre sac", "cart.close": "Fermer le sac", "cart.subtotal": "Sous-total", "cart.confirm": "À confirmer", "cart.checkout": "Commander via WhatsApp", "cart.continue": "Continuer vos achats", "cart.empty": "Votre sélection est vide.", "cart.emptyCopy": "Découvrez les nouveautés ou demandez à Fieldio de trouver une pièce précise.", "cart.account": "Vous avez un compte ?", "cart.login": "Connectez-vous", "cart.faster": "pour commander plus vite.", "collection.filter": "Filtrer et trier", "collection.filterTitle": "Filtrer la sélection", "collection.brand": "Marque", "collection.size": "Taille", "collection.sort": "Trier", "collection.allBrands": "Toutes les marques", "collection.allSizes": "Toutes les tailles", "collection.featured": "En vedette", "collection.name": "Nom", "collection.low": "Prix croissant", "collection.high": "Prix décroissant", "collection.clear": "Effacer les filtres", "collection.piece": "pièce", "collection.pieces": "pièces", "checkout.title": "Finaliser votre demande", "checkout.notice": "Aucun paiement n’est effectué ici. Fieldio confirmera la disponibilité, la livraison et le paiement sur WhatsApp.", "checkout.customer": "Client et livraison", "checkout.name": "Nom complet", "checkout.phone": "Téléphone", "checkout.email": "Adresse e-mail", "checkout.address": "Adresse de livraison", "checkout.note": "Note", "checkout.optional": "Facultatif", "checkout.consent": "Je comprends qu’il s’agit d’une demande qui ne confirme ni disponibilité ni paiement.", "checkout.continue": "Continuer sur WhatsApp", "checkout.preparing": "Préparation…", "checkout.request": "Votre demande", "checkout.shipping": "La livraison et les éventuels frais de sourcing sont confirmés avant paiement.", "home.title": "La sélection Fieldio", "home.intro": "Nouveautés, pièces exceptionnelles et sourcing personnel parmi les marques que vous aimez.", "home.accountTitle": "Gardez votre sélection près de vous.", "home.accountCopy": "Créez un compte pour sauvegarder favoris, coordonnées et demandes de commande.", "home.createAccount": "Créer un compte", "home.signIn": "Vous avez déjà un compte ? Se connecter", "home.luxuryTitle": "Votre bureau du luxe mondial", "home.sourceRequest": "Lancer une demande de sourcing", "home.campaignTitle": "Des essentiels modernes. Choisis avec intention.", "home.viewNew": "Voir les nouveautés", "home.personalTitle": "Votre personal shopper, où que vous soyez.", "home.howItWorks": "Comment ça marche", "home.chat": "Discuter sur WhatsApp", "account.signInTitle": "Heureux de vous revoir", "account.signUpTitle": "Créez votre compte", "account.resetTitle": "Réinitialiser le mot de passe", "account.updateTitle": "Choisir un nouveau mot de passe", "account.intro": "Gérez vos coordonnées, favoris et demandes de commande.", "account.google": "Continuer avec Google", "account.emailMethod": "Continuer avec e-mail", "account.emailPassword": "E-mail et mot de passe", "account.email": "E-mail", "account.password": "Mot de passe", "account.signIn": "Se connecter", "account.create": "Créer un compte", "account.forgot": "Mot de passe oublié ?", "account.reset": "Envoyer le lien", "account.update": "Modifier le mot de passe", "account.showPassword": "Afficher le mot de passe", "account.hidePassword": "Masquer le mot de passe"
};

const de: Dictionary = {
  "announcement.shipping": "Weltweite Beschaffung und Versand", "announcement.whatsapp": "Personal Shopping über WhatsApp", "nav.shop": "Shop", "nav.luxury": "Luxus", "nav.personal": "Personal Shopping", "nav.account": "Konto", "nav.wishlist": "Wunschliste", "nav.search": "Suche", "nav.bag": "Tasche", "nav.new": "Neuheiten", "nav.women": "Damen", "nav.men": "Herren", "nav.bags": "Taschen", "nav.shoes": "Schuhe", "nav.wholesale": "Großhandel", "nav.contact": "Kontakt", "nav.openMenu": "Menü öffnen", "nav.closeMenu": "Menü schließen", "region.open": "Region und Sprache ändern", "region.title": "Region und Sprache", "region.search": "Land oder Währung suchen", "region.language": "Sprache", "region.close": "Region und Sprache schließen", "region.noResults": "Keine passende Region.", "region.auto": "Automatisch für Ihren Standort gewählt. Sie können dies jederzeit ändern.", "region.converted": "Angezeigte Preise basieren auf aktuellen Referenzkursen. Endpreise werden vor der Zahlung bestätigt.", "region.unavailable": "Die Umrechnung ist vorübergehend nicht verfügbar. Originalpreise werden angezeigt.", "common.close": "Schließen", "common.clear": "Löschen", "common.loading": "Laden", "product.priceRequest": "Preis auf Anfrage", "product.new": "Neu", "product.requestOnly": "Nur auf Anfrage", "product.quickRequest": "Schnellanfrage", "product.quickAdd": "Schnell hinzufügen", "product.unavailable": "Nicht verfügbar", "product.closeSizes": "Größen schließen", "product.addRequest": "Anfrage hinzufügen", "product.selectOptions": "Optionen wählen", "product.outOfStock": "Ausverkauft", "product.addBag": "In die Tasche", "product.selectSize": "Größe wählen", "product.requestType": "Anfrageart", "product.soldOut": "Ausverkauft", "product.related": "Das könnte Ihnen gefallen", "cart.title": "Ihre Tasche", "cart.close": "Tasche schließen", "cart.subtotal": "Zwischensumme", "cart.confirm": "Noch zu bestätigen", "cart.checkout": "Über WhatsApp bestellen", "cart.continue": "Weiter einkaufen", "cart.empty": "Ihre Auswahl ist leer.", "cart.emptyCopy": "Entdecken Sie Neuheiten oder lassen Sie Fieldio ein bestimmtes Stück finden.", "cart.account": "Sie haben ein Konto?", "cart.login": "Anmelden", "cart.faster": "für einen schnelleren Checkout.", "collection.filter": "Filtern und sortieren", "collection.filterTitle": "Auswahl filtern", "collection.brand": "Marke", "collection.size": "Größe", "collection.sort": "Sortieren", "collection.allBrands": "Alle Marken", "collection.allSizes": "Alle Größen", "collection.featured": "Empfohlen", "collection.name": "Name", "collection.low": "Preis: aufsteigend", "collection.high": "Preis: absteigend", "collection.clear": "Filter löschen", "collection.piece": "Stück", "collection.pieces": "Stücke", "checkout.title": "Anfrage abschließen", "checkout.notice": "Hier wird keine Zahlung vorgenommen. Fieldio bestätigt Verfügbarkeit, Versand und Zahlung über WhatsApp.", "checkout.customer": "Kunde und Lieferung", "checkout.name": "Vollständiger Name", "checkout.phone": "Telefonnummer", "checkout.email": "E-Mail-Adresse", "checkout.address": "Lieferadresse", "checkout.note": "Notiz", "checkout.optional": "Optional", "checkout.consent": "Ich verstehe, dass dies eine Anfrage ist und weder Verfügbarkeit noch Zahlung bestätigt.", "checkout.continue": "Auf WhatsApp fortfahren", "checkout.preparing": "Anfrage wird vorbereitet…", "checkout.request": "Ihre Anfrage", "checkout.shipping": "Versand und Beschaffungskosten werden vor der Zahlung bestätigt."
};

const es: Dictionary = {
  "announcement.shipping": "Búsqueda y envío a todo el mundo", "announcement.whatsapp": "Compra personal por WhatsApp", "nav.shop": "Tienda", "nav.luxury": "Lujo", "nav.personal": "Compra personal", "nav.account": "Cuenta", "nav.wishlist": "Favoritos", "nav.search": "Buscar", "nav.bag": "Bolsa", "nav.new": "Novedades", "nav.women": "Mujer", "nav.men": "Hombre", "nav.bags": "Bolsos", "nav.shoes": "Zapatos", "nav.wholesale": "Mayorista", "nav.contact": "Contacto", "nav.openMenu": "Abrir menú", "nav.closeMenu": "Cerrar menú", "region.open": "Cambiar región e idioma", "region.title": "Región e idioma", "region.search": "Buscar país o moneda", "region.language": "Idioma", "region.close": "Cerrar región e idioma", "region.noResults": "No hay una región coincidente.", "region.auto": "Elegido automáticamente según tu ubicación. Puedes cambiarlo en cualquier momento.", "region.converted": "Los precios mostrados usan tipos de referencia recientes. El precio final se confirma antes del pago.", "region.unavailable": "La conversión no está disponible temporalmente. Se muestran los precios de origen.", "common.close": "Cerrar", "common.clear": "Borrar", "common.loading": "Cargando", "product.priceRequest": "Precio a consultar", "product.new": "Nuevo", "product.requestOnly": "Solo por encargo", "product.quickRequest": "Solicitud rápida", "product.quickAdd": "Añadir rápido", "product.unavailable": "No disponible", "product.closeSizes": "Cerrar tallas", "product.addRequest": "Añadir solicitud", "product.selectOptions": "Elegir opciones", "product.outOfStock": "Agotado", "product.addBag": "Añadir a la bolsa", "product.selectSize": "Elegir talla", "product.requestType": "Tipo de solicitud", "product.soldOut": "Agotado", "product.related": "También te puede gustar", "cart.title": "Tu bolsa", "cart.close": "Cerrar bolsa", "cart.subtotal": "Subtotal", "cart.confirm": "Por confirmar", "cart.checkout": "Comprar por WhatsApp", "cart.continue": "Seguir comprando", "cart.empty": "Tu selección está vacía.", "cart.emptyCopy": "Explora novedades o pide a Fieldio una pieza concreta.", "cart.account": "¿Tienes una cuenta?", "cart.login": "Inicia sesión", "cart.faster": "para comprar más rápido.", "collection.filter": "Filtrar y ordenar", "collection.filterTitle": "Filtrar la selección", "collection.brand": "Marca", "collection.size": "Talla", "collection.sort": "Ordenar", "collection.allBrands": "Todas las marcas", "collection.allSizes": "Todas las tallas", "collection.featured": "Destacados", "collection.name": "Nombre", "collection.low": "Precio: menor a mayor", "collection.high": "Precio: mayor a menor", "collection.clear": "Borrar filtros", "collection.piece": "pieza", "collection.pieces": "piezas", "checkout.title": "Completa tu solicitud", "checkout.notice": "Aquí no se realiza ningún pago. Fieldio confirmará disponibilidad, envío y pago por WhatsApp.", "checkout.customer": "Cliente y entrega", "checkout.name": "Nombre completo", "checkout.phone": "Teléfono", "checkout.email": "Correo electrónico", "checkout.address": "Dirección de envío", "checkout.note": "Nota", "checkout.optional": "Opcional", "checkout.consent": "Entiendo que esto envía una solicitud y no confirma disponibilidad ni pago.", "checkout.continue": "Continuar en WhatsApp", "checkout.preparing": "Preparando solicitud…", "checkout.request": "Tu solicitud", "checkout.shipping": "El envío y los gastos de búsqueda se confirman antes del pago."
};

const it: Dictionary = { ...en, "announcement.shipping": "Ricerca e spedizione in tutto il mondo", "nav.shop": "Negozio", "nav.luxury": "Lusso", "nav.personal": "Personal shopping", "nav.account": "Account", "nav.wishlist": "Preferiti", "nav.search": "Cerca", "nav.bag": "Borsa", "region.title": "Regione e lingua", "region.search": "Cerca paese o valuta", "region.language": "Lingua", "product.priceRequest": "Prezzo su richiesta", "product.addBag": "Aggiungi alla borsa", "cart.title": "La tua borsa", "cart.checkout": "Ordina via WhatsApp", "checkout.title": "Completa la richiesta", "checkout.continue": "Continua su WhatsApp" };
const pt: Dictionary = { ...en, "announcement.shipping": "Pesquisa e envio para todo o mundo", "nav.shop": "Loja", "nav.luxury": "Luxo", "nav.personal": "Compras pessoais", "nav.account": "Conta", "nav.wishlist": "Favoritos", "nav.search": "Pesquisar", "nav.bag": "Sacola", "region.title": "Região e idioma", "region.search": "Pesquisar país ou moeda", "region.language": "Idioma", "product.priceRequest": "Preço sob consulta", "product.addBag": "Adicionar à sacola", "cart.title": "A sua sacola", "cart.checkout": "Finalizar pelo WhatsApp", "checkout.title": "Concluir pedido", "checkout.continue": "Continuar no WhatsApp" };
const ar: Dictionary = { ...en, "announcement.shipping": "توريد وشحن إلى جميع أنحاء العالم", "announcement.whatsapp": "تسوق شخصي عبر واتساب", "nav.shop": "تسوق", "nav.luxury": "فاخر", "nav.personal": "تسوق شخصي", "nav.account": "الحساب", "nav.wishlist": "المفضلة", "nav.search": "بحث", "nav.bag": "الحقيبة", "nav.new": "وصل حديثًا", "nav.women": "نساء", "nav.men": "رجال", "nav.bags": "حقائب", "nav.shoes": "أحذية", "nav.wholesale": "الجملة", "nav.contact": "اتصل بنا", "nav.openMenu": "فتح القائمة", "nav.closeMenu": "إغلاق القائمة", "region.open": "تغيير المنطقة واللغة", "region.title": "المنطقة واللغة", "region.search": "ابحث عن بلد أو عملة", "region.language": "اللغة", "region.close": "إغلاق المنطقة واللغة", "region.noResults": "لا توجد منطقة مطابقة.", "region.auto": "تم الاختيار تلقائيًا حسب موقعك. يمكنك التغيير في أي وقت.", "region.converted": "تستخدم الأسعار المعروضة أسعار صرف مرجعية حديثة. يتم تأكيد السعر النهائي قبل الدفع.", "region.unavailable": "التحويل المباشر غير متاح مؤقتًا. تظهر الأسعار الأصلية.", "common.close": "إغلاق", "common.clear": "مسح", "common.loading": "جارٍ التحميل", "product.priceRequest": "السعر عند الطلب", "product.new": "جديد", "product.requestOnly": "بالطلب فقط", "product.quickRequest": "طلب سريع", "product.quickAdd": "إضافة سريعة", "product.unavailable": "غير متاح", "product.closeSizes": "إغلاق المقاسات", "product.addRequest": "إضافة الطلب", "product.selectOptions": "اختر الخيارات", "product.outOfStock": "نفد المخزون", "product.addBag": "أضف إلى الحقيبة", "product.selectSize": "اختر المقاس", "product.requestType": "نوع الطلب", "product.soldOut": "نفد", "product.related": "قد يعجبك أيضًا", "cart.title": "حقيبتك", "cart.close": "إغلاق الحقيبة", "cart.subtotal": "المجموع الفرعي", "cart.confirm": "يؤكد لاحقًا", "cart.checkout": "إتمام الطلب عبر واتساب", "cart.continue": "متابعة التسوق", "cart.empty": "اختياراتك فارغة.", "cart.emptyCopy": "اكتشف الجديد أو اطلب من فيلديو توفير قطعة محددة.", "cart.account": "لديك حساب؟", "cart.login": "سجل الدخول", "cart.faster": "لإتمام الطلب بشكل أسرع.", "collection.filter": "تصفية وترتيب", "collection.filterTitle": "تصفية المجموعة", "collection.brand": "العلامة", "collection.size": "المقاس", "collection.sort": "الترتيب", "collection.allBrands": "كل العلامات", "collection.allSizes": "كل المقاسات", "collection.featured": "مختارات", "collection.name": "الاسم", "collection.low": "السعر: من الأقل", "collection.high": "السعر: من الأعلى", "collection.clear": "مسح التصفية", "collection.piece": "قطعة", "collection.pieces": "قطع", "checkout.title": "أكمل طلبك", "checkout.notice": "لا يتم الدفع هنا. ستؤكد فيلديو التوفر والشحن والدفع معك عبر واتساب.", "checkout.customer": "العميل والتوصيل", "checkout.name": "الاسم الكامل", "checkout.phone": "رقم الهاتف", "checkout.email": "البريد الإلكتروني", "checkout.address": "عنوان الشحن", "checkout.note": "ملاحظة", "checkout.optional": "اختياري", "checkout.consent": "أفهم أن هذا طلب ولا يؤكد التوفر أو الدفع.", "checkout.continue": "المتابعة عبر واتساب", "checkout.preparing": "جارٍ تجهيز الطلب…", "checkout.request": "طلبك", "checkout.shipping": "يتم تأكيد الشحن وأي رسوم توريد قبل الدفع." };

const pageTranslations: Partial<Record<LanguageCode, Dictionary>> = {
  de: { "home.title": "Die Fieldio Auswahl", "home.intro": "Neuheiten, außergewöhnliche Stücke und persönliche Beschaffung Ihrer gewünschten Marken.", "home.accountTitle": "Ihre Auswahl bleibt bei Ihnen.", "home.accountCopy": "Erstellen Sie ein Konto, um Wunschliste, Daten und Bestellanfragen zu speichern.", "home.createAccount": "Konto erstellen", "home.signIn": "Bereits registriert? Anmelden", "home.luxuryTitle": "Ihr weltweiter Luxus-Service", "home.sourceRequest": "Beschaffung anfragen", "home.campaignTitle": "Moderne Essentials. Bewusst ausgewählt.", "home.viewNew": "Neuheiten ansehen", "home.personalTitle": "Ihr Personal Shopper, überall für Sie da.", "home.howItWorks": "So funktioniert es", "home.chat": "Über WhatsApp schreiben", "account.signInTitle": "Willkommen zurück", "account.signUpTitle": "Konto erstellen", "account.resetTitle": "Passwort zurücksetzen", "account.updateTitle": "Neues Passwort wählen", "account.intro": "Verwalten Sie Daten, Wunschliste und Bestellanfragen.", "account.google": "Mit Google fortfahren", "account.emailMethod": "Mit E-Mail fortfahren", "account.emailPassword": "E-Mail und Passwort", "account.email": "E-Mail", "account.password": "Passwort", "account.signIn": "Anmelden", "account.create": "Konto erstellen", "account.forgot": "Passwort vergessen?", "account.reset": "Link senden", "account.update": "Passwort ändern", "account.showPassword": "Passwort anzeigen", "account.hidePassword": "Passwort ausblenden" },
  es: { "home.title": "La selección Fieldio", "home.intro": "Novedades, piezas excepcionales y búsqueda personal entre las marcas que deseas.", "home.accountTitle": "Guarda tu selección.", "home.accountCopy": "Crea una cuenta para guardar favoritos, datos y solicitudes de pedido.", "home.createAccount": "Crear cuenta", "home.signIn": "¿Ya tienes una cuenta? Inicia sesión", "home.luxuryTitle": "Tu servicio de lujo mundial", "home.sourceRequest": "Solicitar una búsqueda", "home.campaignTitle": "Esenciales modernos. Elegidos con intención.", "home.viewNew": "Ver novedades", "home.personalTitle": "Tu personal shopper, estés donde estés.", "home.howItWorks": "Cómo funciona", "home.chat": "Hablar por WhatsApp", "account.signInTitle": "Te damos la bienvenida", "account.signUpTitle": "Crea tu cuenta", "account.resetTitle": "Restablece tu contraseña", "account.updateTitle": "Elige una nueva contraseña", "account.intro": "Gestiona tus datos, favoritos y solicitudes.", "account.google": "Continuar con Google", "account.emailMethod": "Continuar con correo", "account.emailPassword": "Correo y contraseña", "account.email": "Correo electrónico", "account.password": "Contraseña", "account.signIn": "Iniciar sesión", "account.create": "Crear cuenta", "account.forgot": "¿Olvidaste la contraseña?", "account.reset": "Enviar enlace", "account.update": "Actualizar contraseña", "account.showPassword": "Mostrar contraseña", "account.hidePassword": "Ocultar contraseña" },
  it: { "home.title": "La selezione Fieldio", "home.intro": "Nuovi arrivi, pezzi eccezionali e ricerca personale tra i marchi che desideri.", "home.accountTitle": "Conserva la tua selezione.", "home.accountCopy": "Crea un account per salvare preferiti, dati e richieste d’ordine.", "home.createAccount": "Crea account", "home.signIn": "Hai già un account? Accedi", "home.luxuryTitle": "Il tuo servizio lusso globale", "home.sourceRequest": "Avvia una richiesta", "home.campaignTitle": "Essenziali moderni. Scelti con cura.", "home.viewNew": "Vedi i nuovi arrivi", "home.personalTitle": "Il tuo personal shopper, ovunque tu sia.", "home.howItWorks": "Come funziona", "home.chat": "Chatta su WhatsApp", "account.signInTitle": "Bentornato", "account.signUpTitle": "Crea il tuo account", "account.resetTitle": "Reimposta la password", "account.updateTitle": "Scegli una nuova password", "account.intro": "Gestisci dati, preferiti e richieste d’ordine.", "account.google": "Continua con Google", "account.emailMethod": "Continua con email", "account.emailPassword": "Email e password", "account.email": "Email", "account.password": "Password", "account.signIn": "Accedi", "account.create": "Crea account", "account.forgot": "Password dimenticata?", "account.reset": "Invia link", "account.update": "Aggiorna password", "account.showPassword": "Mostra password", "account.hidePassword": "Nascondi password" },
  pt: { "home.title": "A seleção Fieldio", "home.intro": "Novidades, peças excecionais e pesquisa pessoal entre as marcas que deseja.", "home.accountTitle": "Guarde a sua seleção.", "home.accountCopy": "Crie uma conta para guardar favoritos, dados e pedidos.", "home.createAccount": "Criar conta", "home.signIn": "Já tem conta? Iniciar sessão", "home.luxuryTitle": "O seu serviço de luxo global", "home.sourceRequest": "Iniciar pedido de pesquisa", "home.campaignTitle": "Essenciais modernos. Escolhidos com intenção.", "home.viewNew": "Ver novidades", "home.personalTitle": "O seu personal shopper, onde estiver.", "home.howItWorks": "Como funciona", "home.chat": "Conversar no WhatsApp", "account.signInTitle": "Bem-vindo de volta", "account.signUpTitle": "Crie a sua conta", "account.resetTitle": "Repor palavra-passe", "account.updateTitle": "Escolha uma nova palavra-passe", "account.intro": "Gira os seus dados, favoritos e pedidos.", "account.google": "Continuar com Google", "account.emailMethod": "Continuar com email", "account.emailPassword": "Email e palavra-passe", "account.email": "Email", "account.password": "Palavra-passe", "account.signIn": "Iniciar sessão", "account.create": "Criar conta", "account.forgot": "Esqueceu a palavra-passe?", "account.reset": "Enviar ligação", "account.update": "Atualizar palavra-passe", "account.showPassword": "Mostrar palavra-passe", "account.hidePassword": "Ocultar palavra-passe" },
  ar: { "home.title": "مختارات فيلديو", "home.intro": "وصل حديثًا وقطع استثنائية وخدمة توريد شخصية للعلامات التي تريدها.", "home.accountTitle": "احتفظ بمختاراتك.", "home.accountCopy": "أنشئ حسابًا لحفظ المفضلة وبياناتك وطلباتك.", "home.createAccount": "إنشاء حساب", "home.signIn": "لديك حساب؟ سجل الدخول", "home.luxuryTitle": "مكتبك العالمي للمنتجات الفاخرة", "home.sourceRequest": "ابدأ طلب توريد", "home.campaignTitle": "أساسيات عصرية. مختارة بعناية.", "home.viewNew": "شاهد الجديد", "home.personalTitle": "متسوقك الشخصي أينما كنت.", "home.howItWorks": "كيف تعمل الخدمة", "home.chat": "تحدث عبر واتساب", "account.signInTitle": "مرحبًا بعودتك", "account.signUpTitle": "أنشئ حسابك", "account.resetTitle": "إعادة تعيين كلمة المرور", "account.updateTitle": "اختر كلمة مرور جديدة", "account.intro": "أدر بياناتك ومفضلتك وطلباتك.", "account.google": "المتابعة عبر Google", "account.emailMethod": "المتابعة بالبريد الإلكتروني", "account.emailPassword": "البريد وكلمة المرور", "account.email": "البريد الإلكتروني", "account.password": "كلمة المرور", "account.signIn": "تسجيل الدخول", "account.create": "إنشاء حساب", "account.forgot": "نسيت كلمة المرور؟", "account.reset": "إرسال الرابط", "account.update": "تحديث كلمة المرور", "account.showPassword": "إظهار كلمة المرور", "account.hidePassword": "إخفاء كلمة المرور" }
};

const utilityTranslations: Partial<Record<LanguageCode, Dictionary>> = {
  fr: { "nav.openBag": "Ouvrir le sac", "nav.items": "articles" },
  de: { "nav.openBag": "Tasche öffnen", "nav.items": "Artikel" },
  es: { "nav.openBag": "Abrir la bolsa", "nav.items": "artículos" },
  it: { "nav.openBag": "Apri la borsa", "nav.items": "articoli" },
  pt: { "nav.openBag": "Abrir a sacola", "nav.items": "artigos" },
  ar: { "nav.openBag": "فتح الحقيبة", "nav.items": "عناصر" }
};

const dictionaries: Record<LanguageCode, Dictionary> = {
  en,
  fr: { ...fr, ...utilityTranslations.fr, "nav.all": "Tout" },
  de: { ...de, ...pageTranslations.de, ...utilityTranslations.de, "nav.all": "Alle" },
  es: { ...es, ...pageTranslations.es, ...utilityTranslations.es, "nav.all": "Todo" },
  it: { ...it, ...pageTranslations.it, ...utilityTranslations.it, "nav.all": "Tutto" },
  pt: { ...pt, ...pageTranslations.pt, ...utilityTranslations.pt, "nav.all": "Tudo" },
  ar: { ...ar, ...pageTranslations.ar, ...utilityTranslations.ar, "nav.all": "الكل" }
};

export function translate(language: LanguageCode, key: TranslationKey): string {
  return dictionaries[language][key] ?? en[key];
}
