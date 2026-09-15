import type { SupportedLocale } from "@cleanhub/i18n";

type SetupCopy = {
  brandSuffix: string;
  bootstrap: {
    loading: string;
    loadingDescription: string;
    errorTitle: string;
    errorDescription: string;
    retry: string;
    disabledTitle: string;
    disabledDescription: string;
    disabledHint: string;
    credentialLostTitle: string;
    credentialLostDescription: string;
    setupRequiredTitle: string;
    setupRequiredDescription: string;
    startSetup: string;
    checking: string;
    readyTitle: string;
    readyDescription: string;
  };
  setup: {
    eyebrow: string;
    title: string;
    description: string;
    steps: {
      admin: string;
      branch: string;
      terminal: string;
    };
    admin: {
      title: string;
      description: string;
      identifier: string;
      identifierPlaceholder: string;
      password: string;
      passwordPlaceholder: string;
      submit: string;
      submitting: string;
      ownerManagerOnly: string;
      invalidRole: string;
      loginFailed: string;
    };
    tenant: {
      organization: string;
      signedInAs: string;
      changeAccount: string;
    };
    branch: {
      title: string;
      descriptionOwner: string;
      descriptionManager: string;
      noBranches: string;
      managerAssignmentInvalid: string;
      inactive: string;
      selected: string;
      continue: string;
    };
    terminal: {
      title: string;
      description: string;
      label: string;
      labelPlaceholder: string;
      labelHint: string;
      device: string;
      tenant: string;
      branch: string;
      securityTitle: string;
      securityDescription: string;
      hardwareTitle: string;
      hardwareDescription: string;
      hardwareScanning: string;
      hardwareNone: string;
      hardwareEnvironmentUnavailable: string;
      hardwareFailed: string;
      hardwareRetry: string;
      hardwarePrinter: string;
      hardwareScanner: string;
      hardwareDetected: string;
      hardwareServiceUnavailable: string;
      back: string;
      confirm: string;
      confirming: string;
      failed: string;
    };
    complete: {
      title: string;
      description: string;
      redirecting: string;
      signOutFailed: string;
      retry: string;
    };
    recovery: {
      badge: string;
      hint: string;
      branchUnavailable: string;
      labelHint: string;
      unnamedTerminal: string;
      confirm: string;
      confirming: string;
    };
  };
};

const COPY: Record<SupportedLocale, SetupCopy> = {
  "zh-CN": {
    brandSuffix: "门店收银系统",
    bootstrap: {
      loading: "正在检查这台终端",
      loadingDescription: "确认设备登记状态与门店归属，请稍候。",
      errorTitle: "暂时无法检查终端状态",
      errorDescription:
        "请检查网络连接后重试。如果问题持续存在，请联系系统管理员。",
      retry: "重新检查",
      disabledTitle: "这台终端已停用",
      disabledDescription: "为保护门店数据，当前设备暂时不能登录。",
      disabledHint: "请联系店主或店长，在租户后台重新启用这台收银终端。",
      credentialLostTitle: "需要恢复终端凭据",
      credentialLostDescription:
        "设备登记记录仍然存在，但本机凭据已经失效或被清除。",
      setupRequiredTitle: "这台终端尚未完成登记",
      setupRequiredDescription:
        "请由店主或店长完成一次初始化，之后员工即可使用 PIN 快速登录。",
      startSetup: "开始设置",
      checking: "检查中…",
      readyTitle: "终端已就绪",
      readyDescription: "请输入员工 PIN 进入当前门店。",
    },
    setup: {
      eyebrow: "POS 终端初始化",
      title: "设置这台收银终端",
      description: "一次完成账号验证、门店绑定与设备登记。",
      steps: {
        admin: "验证账号",
        branch: "选择门店",
        terminal: "确认登记",
      },
      admin: {
        title: "请店主或店长验证身份",
        description:
          "使用租户管理账号登录。系统会自动识别所属租户，不需要输入租户编码。",
        identifier: "邮箱",
        identifierPlaceholder: "请输入管理账号邮箱",
        password: "密码",
        passwordPlaceholder: "请输入密码",
        submit: "继续",
        submitting: "正在验证…",
        ownerManagerOnly: "只有店主或店长可以登记新的 POS 终端。",
        invalidRole: "当前账号没有登记终端的权限，请使用店主或店长账号。",
        loginFailed: "账号验证失败，请检查邮箱和密码。",
      },
      tenant: {
        organization: "所属租户",
        signedInAs: "当前账号",
        changeAccount: "更换账号",
      },
      branch: {
        title: "选择这台终端所在的门店",
        descriptionOwner: "请选择实际放置并使用这台终端的门店。",
        descriptionManager: "系统仅展示当前店长可以管理的门店。",
        noBranches: "当前账号没有可用于 POS 的启用门店。",
        managerAssignmentInvalid:
          "店长账号必须且只能分配一个启用门店。请先在租户后台修正门店权限，再登记终端。",
        inactive: "已停用",
        selected: "已选择",
        continue: "继续",
      },
      terminal: {
        title: "确认终端信息",
        description: "为设备填写容易识别的名称，并核对租户和门店。",
        label: "终端名称",
        labelPlaceholder: "例如：旗舰店前台 1 号机",
        labelHint: "建议使用“门店 + 柜台/设备编号”，便于后续维护。",
        device: "设备标识",
        tenant: "租户",
        branch: "门店",
        securityTitle: "凭据只会安装在当前设备",
        securityDescription:
          "登记成功后，终端凭据将通过 HttpOnly Cookie 安全保存，不会在页面中展示。",
        hardwareTitle: "本机内置硬件检查",
        hardwareDescription:
          "这里只读取当前设备自身的内置硬件，不扫描附近的蓝牙设备，也不会执行测试打印、测试扫码或登记硬件。进入系统后可在设置页测试连接。",
        hardwareScanning: "正在检查本机内置硬件…",
        hardwareNone:
          "未识别到受支持的内置硬件。仍可继续登记，之后可在设置页添加外接设备。",
        hardwareEnvironmentUnavailable:
          "当前运行环境未提供原生硬件检测能力。仍可继续登记终端。",
        hardwareFailed:
          "本机硬件检查失败，不影响终端登记。可重试或稍后在设置页检查。",
        hardwareRetry: "重新检查",
        hardwarePrinter: "内置热敏打印机",
        hardwareScanner: "内置扫码器",
        hardwareDetected: "已识别",
        hardwareServiceUnavailable: "已识别，服务未就绪",
        back: "上一步",
        confirm: "登记终端",
        confirming: "正在登记…",
        failed: "终端登记失败，请稍后重试。",
      },
      complete: {
        title: "终端登记完成",
        description: "这台设备已与门店安全绑定，员工现在可以使用 PIN 登录。",
        redirecting: "正在进入员工登录…",
        signOutFailed:
          "终端已登记，但管理员会话退出失败。请重试后再进入员工登录。",
        retry: "重试并进入登录",
      },
      recovery: {
        badge: "终端恢复",
        hint: "验证管理员身份后，将为当前设备重新安装终端凭据。",
        branchUnavailable:
          "当前账号无法管理这台终端原先绑定的启用门店。恢复操作不会更改门店，请使用有权管理该门店的店主或店长账号。",
        labelHint: "恢复只会重新安装设备凭据，不会修改原终端名称或门店归属。",
        unnamedTerminal: "未命名终端",
        confirm: "恢复终端凭据",
        confirming: "正在恢复…",
      },
    },
  },
  en: {
    brandSuffix: "Store POS",
    bootstrap: {
      loading: "Checking this terminal",
      loadingDescription: "Confirming its enrollment and store assignment.",
      errorTitle: "Terminal status is unavailable",
      errorDescription:
        "Check the network and try again. Contact an administrator if the issue continues.",
      retry: "Check again",
      disabledTitle: "This terminal is disabled",
      disabledDescription: "This device cannot sign in while it is disabled.",
      disabledHint:
        "Ask an owner or manager to enable this POS terminal in the back office.",
      credentialLostTitle: "Terminal recovery is required",
      credentialLostDescription:
        "The enrollment record exists, but this device credential is missing or no longer valid.",
      setupRequiredTitle: "This terminal is not set up",
      setupRequiredDescription:
        "An owner or manager must complete setup once. Staff can then sign in quickly with a PIN.",
      startSetup: "Set up terminal",
      checking: "Checking…",
      readyTitle: "Terminal ready",
      readyDescription: "Enter a staff PIN to open this store.",
    },
    setup: {
      eyebrow: "POS terminal setup",
      title: "Set up this POS terminal",
      description: "Verify an account, assign a store, and enroll this device.",
      steps: {
        admin: "Verify account",
        branch: "Choose store",
        terminal: "Confirm enrollment",
      },
      admin: {
        title: "Owner or manager verification",
        description:
          "Sign in with a tenant administrator account. The tenant is identified automatically; no tenant code is required.",
        identifier: "Email",
        identifierPlaceholder: "Enter the administrator email",
        password: "Password",
        passwordPlaceholder: "Enter the password",
        submit: "Continue",
        submitting: "Verifying…",
        ownerManagerOnly:
          "Only an owner or manager can enroll a new POS terminal.",
        invalidRole:
          "This account cannot enroll terminals. Use an owner or manager account.",
        loginFailed:
          "Account verification failed. Check the email and password.",
      },
      tenant: {
        organization: "Tenant",
        signedInAs: "Signed in as",
        changeAccount: "Use another account",
      },
      branch: {
        title: "Choose the store for this terminal",
        descriptionOwner:
          "Select the store where this terminal will physically be used.",
        descriptionManager: "Only stores available to this manager are shown.",
        noBranches: "This account has no active store available for POS.",
        managerAssignmentInvalid:
          "A manager must be assigned to exactly one active store. Correct the store assignment in the back office before enrolling this terminal.",
        inactive: "Inactive",
        selected: "Selected",
        continue: "Continue",
      },
      terminal: {
        title: "Confirm terminal details",
        description:
          "Give the device a recognizable name and verify its tenant and store.",
        label: "Terminal name",
        labelPlaceholder: "For example: Flagship front desk 1",
        labelHint:
          "Use the store and counter/device number so the terminal is easy to maintain.",
        device: "Device ID",
        tenant: "Tenant",
        branch: "Store",
        securityTitle: "The credential is installed only on this device",
        securityDescription:
          "After enrollment, the terminal credential is stored securely in an HttpOnly cookie and is never shown on screen.",
        hardwareTitle: "Built-in hardware check",
        hardwareDescription:
          "This reads only hardware built into the current device. It does not scan nearby Bluetooth devices, run print/scan tests, or register hardware. Test connections in Settings after enrollment.",
        hardwareScanning: "Checking this device’s built-in hardware…",
        hardwareNone:
          "No supported built-in hardware was identified. You can continue enrollment and add external devices later in Settings.",
        hardwareEnvironmentUnavailable:
          "This runtime does not provide native hardware inspection. You can still continue enrollment.",
        hardwareFailed:
          "The local hardware check failed. Enrollment is unaffected; retry now or check later in Settings.",
        hardwareRetry: "Check again",
        hardwarePrinter: "built-in thermal printer",
        hardwareScanner: "built-in scanner",
        hardwareDetected: "Identified",
        hardwareServiceUnavailable: "Identified, service not ready",
        back: "Back",
        confirm: "Enroll terminal",
        confirming: "Enrolling…",
        failed: "Terminal enrollment failed. Try again.",
      },
      complete: {
        title: "Terminal enrolled",
        description:
          "This device is securely assigned to the store. Staff can now sign in with a PIN.",
        redirecting: "Opening staff sign-in…",
        signOutFailed:
          "The terminal is enrolled, but the administrator session could not be closed. Retry before staff sign-in.",
        retry: "Retry and open sign-in",
      },
      recovery: {
        badge: "Terminal recovery",
        hint: "After administrator verification, a new terminal credential will be installed on this device.",
        branchUnavailable:
          "This account cannot manage the active store originally assigned to this terminal. Recovery does not change its store; use an owner or manager who can manage that store.",
        labelHint:
          "Recovery only reinstalls the device credential. It does not change the existing terminal name or store assignment.",
        unnamedTerminal: "Unnamed terminal",
        confirm: "Restore terminal credential",
        confirming: "Restoring…",
      },
    },
  },
  fr: {
    brandSuffix: "Caisse magasin",
    bootstrap: {
      loading: "Vérification du terminal",
      loadingDescription:
        "Vérification de l’enregistrement et du magasin associé.",
      errorTitle: "État du terminal indisponible",
      errorDescription:
        "Vérifiez le réseau et réessayez. Si le problème persiste, contactez un administrateur.",
      retry: "Vérifier à nouveau",
      disabledTitle: "Ce terminal est désactivé",
      disabledDescription:
        "Cet appareil ne peut pas se connecter tant qu’il est désactivé.",
      disabledHint:
        "Demandez au propriétaire ou au responsable de réactiver ce terminal dans l’administration.",
      credentialLostTitle: "Récupération du terminal requise",
      credentialLostDescription:
        "L’enregistrement existe, mais l’identifiant de cet appareil est absent ou invalide.",
      setupRequiredTitle: "Ce terminal n’est pas configuré",
      setupRequiredDescription:
        "Un propriétaire ou un responsable doit effectuer la configuration initiale. Le personnel pourra ensuite utiliser son PIN.",
      startSetup: "Configurer le terminal",
      checking: "Vérification…",
      readyTitle: "Terminal prêt",
      readyDescription: "Saisissez le PIN d’un employé pour ouvrir ce magasin.",
    },
    setup: {
      eyebrow: "Configuration du terminal POS",
      title: "Configurer ce terminal POS",
      description:
        "Vérifiez un compte, choisissez un magasin et enregistrez cet appareil.",
      steps: {
        admin: "Vérifier le compte",
        branch: "Choisir le magasin",
        terminal: "Confirmer",
      },
      admin: {
        title: "Vérification du propriétaire ou responsable",
        description:
          "Connectez-vous avec un compte administrateur du locataire. Le locataire est identifié automatiquement, sans code.",
        identifier: "E-mail",
        identifierPlaceholder: "Saisissez l’e-mail administrateur",
        password: "Mot de passe",
        passwordPlaceholder: "Saisissez le mot de passe",
        submit: "Continuer",
        submitting: "Vérification…",
        ownerManagerOnly:
          "Seul un propriétaire ou responsable peut enregistrer un terminal POS.",
        invalidRole:
          "Ce compte ne peut pas enregistrer de terminal. Utilisez un compte propriétaire ou responsable.",
        loginFailed:
          "Échec de la vérification. Contrôlez l’e-mail et le mot de passe.",
      },
      tenant: {
        organization: "Locataire",
        signedInAs: "Connecté en tant que",
        changeAccount: "Changer de compte",
      },
      branch: {
        title: "Choisir le magasin de ce terminal",
        descriptionOwner:
          "Sélectionnez le magasin où ce terminal sera réellement utilisé.",
        descriptionManager:
          "Seuls les magasins accessibles à ce responsable sont affichés.",
        noBranches: "Ce compte ne dispose d’aucun magasin actif pour le POS.",
        managerAssignmentInvalid:
          "Un responsable doit être affecté à un seul magasin actif. Corrigez l’affectation dans l’administration avant d’enregistrer ce terminal.",
        inactive: "Inactif",
        selected: "Sélectionné",
        continue: "Continuer",
      },
      terminal: {
        title: "Confirmer les informations du terminal",
        description:
          "Donnez un nom reconnaissable à l’appareil et vérifiez son locataire et son magasin.",
        label: "Nom du terminal",
        labelPlaceholder: "Ex. : Boutique principale caisse 1",
        labelHint:
          "Utilisez le magasin et le numéro de caisse/appareil pour faciliter la maintenance.",
        device: "Identifiant de l’appareil",
        tenant: "Locataire",
        branch: "Magasin",
        securityTitle: "L’identifiant est installé uniquement sur cet appareil",
        securityDescription:
          "Après l’enregistrement, l’identifiant du terminal est conservé dans un cookie HttpOnly et n’est jamais affiché.",
        hardwareTitle: "Vérification du matériel intégré",
        hardwareDescription:
          "Cette vérification lit uniquement le matériel intégré à cet appareil. Elle ne recherche pas les appareils Bluetooth proches, ne lance aucun test d’impression ou de lecture et n’enregistre aucun matériel. Testez les connexions dans les réglages après l’enregistrement.",
        hardwareScanning: "Vérification du matériel intégré…",
        hardwareNone:
          "Aucun matériel intégré pris en charge n’a été identifié. Vous pouvez poursuivre et ajouter des appareils externes plus tard dans les réglages.",
        hardwareEnvironmentUnavailable:
          "Cet environnement ne fournit pas de détection matérielle native. Vous pouvez poursuivre l’enregistrement.",
        hardwareFailed:
          "La vérification locale a échoué sans bloquer l’enregistrement. Réessayez ou vérifiez plus tard dans les réglages.",
        hardwareRetry: "Vérifier à nouveau",
        hardwarePrinter: "imprimante thermique intégrée",
        hardwareScanner: "lecteur intégré",
        hardwareDetected: "Identifié",
        hardwareServiceUnavailable: "Identifié, service indisponible",
        back: "Retour",
        confirm: "Enregistrer le terminal",
        confirming: "Enregistrement…",
        failed: "Échec de l’enregistrement du terminal. Réessayez.",
      },
      complete: {
        title: "Terminal enregistré",
        description:
          "Cet appareil est associé au magasin en toute sécurité. Le personnel peut maintenant utiliser son PIN.",
        redirecting: "Ouverture de la connexion employé…",
        signOutFailed:
          "Le terminal est enregistré, mais la session administrateur n’a pas pu être fermée. Réessayez avant la connexion employé.",
        retry: "Réessayer et ouvrir la connexion",
      },
      recovery: {
        badge: "Récupération du terminal",
        hint: "Après vérification de l’administrateur, un nouvel identifiant sera installé sur cet appareil.",
        branchUnavailable:
          "Ce compte ne peut pas gérer le magasin actif initialement associé à ce terminal. La récupération ne change pas de magasin ; utilisez un propriétaire ou responsable autorisé.",
        labelHint:
          "La récupération réinstalle uniquement l’identifiant de l’appareil. Elle ne modifie ni le nom du terminal ni le magasin associé.",
        unnamedTerminal: "Terminal sans nom",
        confirm: "Restaurer l’identifiant",
        confirming: "Restauration…",
      },
    },
  },
};

export function getTerminalSetupCopy(locale: SupportedLocale): SetupCopy {
  return COPY[locale];
}
