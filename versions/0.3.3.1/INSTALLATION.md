# Installer CELK 0.3.3.1

Vérifier [les SHA‑256](SHA256SUMS.txt) avant extraction. Le manifeste FiveM demande FXServer 38435 ou supérieur, GTA build 3889, OneSync et le runtime Node 22 de FXServer. La préparation externe a été vérifiée avec Node 24.22.1 sous Windows.

## Préparer le dépôt

1. Extraire le préparateur à la racine du dossier de travail. Extraire le ZIP du cœur dans le sous-dossier `runtime` pour obtenir `runtime/celk_runtime/fxmanifest.lua`.
2. Créer une instance sous le dossier de travail et configurer son `policy.json` en limitant les éditeurs aux identités approuvées par l’administrateur. Extraire le ZIP Sadler dans `instance/packs`, en gardant le dossier `sadler-jeu-v01-9bf8d35c` et son `installation.json`.
3. Préparer et vérifier la génération avec `node launcher.cjs --home instance`. Pour inclure l’administration des packs, employer `node launcher-admin.cjs --home instance` et sélectionner le dossier Sadler dans `instance/selection-admin.json` au format `celk.admin-selection` v1 avant le premier démarrage.
4. Préparer la configuration privée de lancement de l’instance et ses empreintes selon le [guide de configuration du lanceur CELK](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/428ea7a7bb56ebf9dca75775d144db9e336fa3c0/versions/0.3.2/INSTALLATION.md). Avec l’administration, utiliser `node launcher-admin.cjs --home instance --start` pour démarrer également le gestionnaire de dépôt.

**Démarrer les ressources des packs avant `celk_runtime`.** Le préparateur génère cet ordre dans la génération. Les ensembles doivent garder leur dossier complet et leurs manifestes. Le dépôt se prépare avant le démarrage FXServer.

## Intégrations facultatives

| Téléchargement | Ressources fournies et dépendances |
| --- | --- |
| Adaptateur Qbox | `celk_qbox_adapter` version 0.3.3, à utiliser avec Qbox Core 1.24.1, Vehicles 1.4.2 et Garages 1.1.4. Installer Qbox auprès de ses éditeurs. |
| Adaptateur LVC | Plugin CELK pour **LVC 3.2.9 Rev2**. Installer LVC et le RageUI de son éditeur. Extraire le dossier `PLUGINS/CELK` dans la ressource LVC existante. |
| Adaptateur Interface ox_lib | `celk_menu_ox` version 0.3.3.1, exemple du raccord J/F6 v1. Démarrer `ox_lib` 3.42.2, puis les packs et le cœur CELK, puis cet adaptateur. Régler `setr celk_interface_provider celk_menu_ox` pour le sélectionner. |

Les ZIP Qbox et LVC reprennent les octets des adaptateurs neutres de la 0.3.2 sous des noms associés à cette édition. Les adaptateurs sont facultatifs en mode autonome. En mode Qbox, le cœur vérifie le raccord garage avant d’autoriser les opérations.

L’administration autonome prend F10 par défaut. Si un autre menu admin possède la touche, régler `setr celk_admin_owns_f10 0` et faire appeler la commande client `celk_admin` depuis ce menu. Accorder l’ACE `celk.admin.packs` aux administrateurs concernés. Dans le tableau CELK, enregistrer les cases **Au redémarrage**, puis redémarrer sur la génération admise.
