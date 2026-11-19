# Chaîne Studio → Atelier → FiveM · référence publique CELK 0.3.2

État documentaire vérifié le 19 novembre 2026. Ce document décrit la référence publiée et une procédure de validation; il ne fournit pas les outils privés de création, ne modifie aucun ZIP et ne qualifie aucune future version.

## Référence figée

- Publication : [préversion v0.3.2](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.2).
- Commit du tag vérifié : [689a065f49776c0c2903633ae536202d3602f5b0](https://github.com/MrSpinoQc/custom-emergency-light-kits/commit/689a065f49776c0c2903633ae536202d3602f5b0).
- Documentation corrigée après publication utilisée ici : [428ea7a7bb56ebf9dca75775d144db9e336fa3c0](https://github.com/MrSpinoQc/custom-emergency-light-kits/commit/428ea7a7bb56ebf9dca75775d144db9e336fa3c0). Elle précise notamment les noms des adaptateurs « pour-0.3.2 » sans changer les octets qualifiés.
- [Installation figée](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/428ea7a7bb56ebf9dca75775d144db9e336fa3c0/versions/0.3.2/INSTALLATION.md), [compatibilité figée](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/428ea7a7bb56ebf9dca75775d144db9e336fa3c0/COMPATIBILITE.md), [notes et portée des essais](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/428ea7a7bb56ebf9dca75775d144db9e336fa3c0/versions/0.3.2/README.md), [empreintes des sept ZIP](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/428ea7a7bb56ebf9dca75775d144db9e336fa3c0/versions/0.3.2/SHA256SUMS.txt).

| Élément | Référence publique |
| --- | --- |
| Cœur | CELK 0.3.2; identifiant interne `0.3.2-prototype.1` |
| Préparateur de dépôt | 0.3.2 |
| Packs | Phantom 0.1.0; Airport Bus 0.5.0; Kuruma 0.5.0-refonte.2 |
| Adaptateurs CELK | ZIP séparés Qbox et LVC nommés `pour-0.3.2`; [fiche conservant le tag historique adaptateurs-v0.3.3](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/adaptateurs-v0.3.3) |
| Serveur vérifié | Windows, FXServer 38435, GTA build 3889, OneSync, Node 22 fourni par FXServer |
| Préparation externe vérifiée | Node 24.22.1 sous Windows |
| Intégrations optionnelles | Qbox Core 1.24.1, Vehicles 1.4.2, Garages 1.1.4; LVC 3.2.9 Rev2 et RageUI éditeur |

Le tag historique des adaptateurs ne désigne ni une nouvelle version du cœur ni le prochain lot fonctionnel. Les ressources Qbox/LVC sont à obtenir auprès de leurs éditeurs.

## Ce qui traverse chaque étape

| Étape | Entrée / sortie attendue | Ce qui est vérifié publiquement |
| --- | --- | --- |
| Studio → Atelier | Pièces et références de création destinées à l'édition | La version exacte du Studio, la version exacte de l'Atelier et leur schéma complet d'échange ne sont pas établis par les documents publics cités. Ne pas déduire leur compatibilité du numéro CELK. |
| Atelier → pack JEU | Export complet d'un ensemble FiveM | Le lecteur public attend un ensemble contenant `installation.json`, `selection/selection.celk` et les ressources déclarées sous `resources/`. Un montage seul, une ressource seule ou une enveloppe incompatible ne remplace pas cet ensemble. |
| Pack JEU → préparateur | Dossiers complets extraits dans le dépôt | Le préparateur produit une génération contenant les ressources, la configuration et l'ordre de démarrage. |
| Génération → FiveM | Dossier de données de la génération retenue | Le serveur doit démarrer sur cette génération. Avec Qbox/LVC, rendre aussi disponibles les dépendances et adaptateurs selon le guide. |

Ce tableau ne constitue pas un schéma JSON complet ni une spécification de compilateur 3D. Les conversions internes, versions d'exporteur et contrats non publiés restent à documenter avant d'en faire une référence publique. Ne pas fabriquer ou corriger à la main un manifeste pour faire passer un export refusé.

## Profil autonome Studio → Atelier

**Cible :** permettre à un nouveau contexte Studio de produire un dossier importable dans l'Atelier pour les types de pièces actuellement pris en charge, sans FiveM ni laboratoire. Ce profil est distinct du pack JEU et de la préparation serveur ci-dessous.

**Statut : non spécifié publiquement dans les références vérifiées.** Il ne faut pas utiliser `installation.json` ou `selection/selection.celk` du pack JEU comme modèle présumé d'import Atelier. Aucun dossier minimal importable Studio → Atelier n'est fourni ici : sa compatibilité n'a pas été vérifiée à partir d'un contrat public.

Avant de déclarer ce profil reproductible, publier ou référencer explicitement :
- la version de l'Atelier et les catégories d'assets prises en charge;
- l'arborescence d'entrée, le nom et la version du manifeste;
- les identifiants stables et règles de collision/référence;
- unités, axes, origine, pivots, transformations et conventions de placement;
- les outils/exporteurs autorisés, leurs versions, options et commande exacte;
- les matériaux, canaux de lumière et ressources acceptés;
- un exemple minimal public avec résultat d'import vérifié dans une copie vierge de l'Atelier.

Tous ces éléments sont **à vérifier pour le profil Studio → Atelier**; les versions, fichiers et preuves FiveM plus bas ne les établissent pas.

### Consigne réutilisable pour un nouveau contexte Studio

> Travaille uniquement sur le profil Studio → Atelier documenté pour la version cible, sans FiveM ni laboratoire. Commence par identifier le contrat public et un exemple minimal importé avec succès. Produis une nouvelle copie du dossier d'export, avec les outils, options, identifiants, unités et pivots prescrits. Si le contrat ou un type d'asset manque, indique précisément le point non vérifié et conserve la dernière sortie fonctionnelle; ne fabrique pas de manifeste et n'annonce pas un import réussi sans preuve.

Un accessoire ou une pièce supportée n'implique pas une nouvelle mécanique. **L'attelage de remorque**, par exemple, est une capacité distincte à spécifier et valider; ce document ne le déclare pas pris en charge. Même distinction pour tout mouvement, articulation ou interaction non documenté.

## Sortie sûre et parcours reproductible

Conserver l'export source intact. Préparer une copie dans un nouveau dossier de travail; ne jamais écraser la dernière génération fonctionnelle pendant un essai. Les noms ci-dessous sont des chemins relatifs génériques, pas une configuration prête à démarrer un serveur existant.

```text
runtime/
  celk_runtime/
    fxmanifest.lua
instance/
  policy.json
  packs/
    <ensemble-complet>/
      installation.json
      selection/selection.celk
      resources/
```

Après vérification des téléchargements et configuration initiale documentée, serveur arrêté, depuis le dossier du préparateur :

```text
node launcher.cjs --home instance
```

Lire le résultat, `instance/CURRENT` et le chemin `folder` de la génération produite. Vérifier les ressources et `start-order.cfg` avant de sélectionner cette génération dans le gestionnaire du serveur.

Ajouter un pack compatible signifie **extraire le dossier complet, relancer la préparation, puis redémarrer avec la génération produite**. Ce n'est pas un import de ZIP brut par le serveur ni un simple dépôt sans préparation. Le parcours publié évite une nouvelle entrée de pack au CFG global; il ne supprime pas la configuration initiale ni les prérequis des intégrations. Voir le guide figé pour la politique d'admission, les permissions et les modes de lancement. Ne pas copier une politique d'auteur de confiance sans décision de l'administrateur.

### Reçu de compilation/export à compléter

Gabarit documentaire uniquement : ce bloc ne doit pas être utilisé comme manifeste d'installation.

```text
Version publique CELK :
Version interne du lecteur :
Tag et commit :
Version de l'exporteur Studio : vérifiée / non établie
Version de l'Atelier : vérifiée / non établie
Nom exact du ZIP JEU :
SHA-256 calculé et référence publiée correspondante :
Préparateur et environnement :
Génération produite :
Adaptateur(s) et paire vérifiée, ou mode autonome :
Contrôles banc :
Contrôles GTA solo :
Multijoueur / charge : vérifiés / non qualifiés
Dernière combinaison fonctionnelle conservée :
Décision : accepté / refusé / à vérifier
```

Ne publier dans ce reçu aucun secret, chemin personnel, sauvegarde de joueur, configuration privée ou preuve interne non destinée au public.

## Validation et dernière version fonctionnelle

1. Comparer le nom, la version interne et le SHA-256 de chaque archive à la référence publique; conserver les octets d'origine.
2. Vérifier l'ensemble complet et les dépendances avant préparation. En cas de refus, garder le diagnostic et l'export original; ne pas contourner les contrôles.
3. Vérifier la génération produite sur une copie isolée. Un succès de préparation n'est pas une validation visuelle GTA.
4. Séparer les preuves : contrôle de format, démarrage FXServer, solo GTA, multijoueur et charge.
5. Ne promouvoir la nouvelle combinaison qu'après les contrôles exigés pour son usage. Conserver l'ancienne combinaison complète (lecteur, packs, adaptateurs, configuration et données compatibles) pour retour arrière.
6. Tester la reprise des sauvegardes sur une copie avant remplacement; ne pas présumer une migration compatible.

**Portée publique 0.3.2 :** passage d'un ensemble à trois sans entrée de pack ajoutée au CFG; démarrage des quatre combinaisons avec/sans Qbox et LVC au banc. La Kuruma Police v2 a été validée en GTA solo avec le garage Qbox officiel et LVC : éclats, sirène et retour des sept pièces posées, feux éteints. Les essais historiques Phantom/Bus conservent leur portée d'origine. Le multijoueur, les performances sous charge et les versions tierces hors matrice ne sont pas qualifiés. OP Garages et JG Mechanic ne sont pas couverts par cette validation.

## Checklist d'une future sortie

- [ ] Identifier lecteur, exporteurs, formats et prérequis exacts; marquer les inconnus au lieu d'inventer une compatibilité.
- [ ] Figer les ZIP JEU réellement testés, leur provenance, droits et empreintes.
- [ ] Établir la paire exacte runtime/adaptateur facultatif; fournir un ZIP séparé ou un lien immuable vers la paire toujours compatible. Signaler toute paire manquante avant publication.
- [ ] Rejouer préparation, reprise et contrôles requis sur les mêmes octets; distinguer chaque niveau de preuve.
- [ ] Fournir installation initiale, ajout de pack, diagnostic et retour arrière.
- [ ] Publier uniquement après autorisation, avec tag et Release propres à cette version; ne pas déplacer un tag existant.
- [ ] Joindre uniquement les ZIP correspondants dans Assets si possible; sinon indiquer la limite et des liens directs immuables vérifiés. Les archives automatiques de code source ne sont pas des packs jouables.
- [ ] Retélécharger les livrables publics et vérifier les SHA-256, pages et liens.
- [ ] Conserver les anciennes Releases séparément avec leur portée et leurs limites; ne rien supprimer pour masquer une incompatibilité.

Cette checklist est une politique documentaire pour les prochaines sorties, pas l'annonce d'une implémentation ou d'une nouvelle qualification.
