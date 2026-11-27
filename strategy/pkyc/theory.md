# Revue périodique et surveillance des transactions : jusqu'où peut-on aller ?

Flux « Max », 27 novembre 2026. Note de travail pour le propriétaire. **Ce n'est
pas un avis juridique.** Aucune donnée réelle ; tous les taux, seuils et volumes
marqués *(illustratif)* sont inventés. Maquette : `docs/lab/pkyc.html`.

Légende : **[Texte]** = vérifié dans la source citée. **[Projet]** = texte non
adopté. **[Analyse]** = mon raisonnement, à faire valider. **[Non vérifié]** =
source secondaire ou non contrôlée.

« NPR » : votre terme, compris comme le **profil de risque du client**. Je ne
devine pas ce que le sigle développe.

---

## 1. La réponse d'abord

| Question | Réponse |
|---|---|
| Délai maximal entre deux mises à jour ? | **1 an** pour les clients à risque plus élevé soumis à la vigilance renforcée, **5 ans pour tous les autres**. [Texte, art. 26(2)] |
| 3 ans pour le risque moyen ? | **Pas dans l'AMLR.** C'est une pratique (EY mentionne des cycles de un, trois et cinq ans, 8 novembre 2024). Aucune enquête de marché trouvée. |
| La vigilance simplifiée permet-elle de dépasser 5 ans ? | **Non.** Elle permet de réduire la fréquence (art. 33(1)(b)), sous le plafond « en tout état de cause ». L'AMLA a refusé toute flexibilité au-delà. [Texte + Projet] |
| « Je ne revois jamais mes clients à faible risque » ? | **Indéfendable.** |
| « Je ne vérifie que quand le TBM voit un écart » ? | **Insuffisant** : c'est l'art. 26(3), qui s'applique *en plus* du 26(2). [Analyse] |
| « Je n'organise plus de campagne manuelle : revue automatisée, contact seulement par exception » ? | **Défendable avec conditions**, mais le point décisif (une revue qui conclut « rien à changer » sur données internes vaut-elle mise à jour ?) **n'est pas tranché**. Les lignes directrices AMLA sont encore en révision. |

**La reformulation que je propose** : la mise à jour s'effectue en continu, donnée
par donnée, avec trois états traçables (**confirmée**, **actualisée**,
**présumée inchangée**) ; au plus tard tous les 5 ans chaque client reçoit une
revue documentée ; seules les exceptions donnent lieu à un travail manuel ou à un
contact. Ce n'est pas « pas de revue » : c'est « pas de campagne de remédiation ».

---

## 2. Ce que disent les textes

### 2.1 AMLR, règlement (UE) 2024/1624 [Texte, version française du dépôt]

Art. 26(2) :
> Dans le cadre de la surveillance continue visée au paragraphe 1, les entités assujetties veillent à ce que les documents, données ou informations pertinents relatifs au client soient tenus à jour.

> La période entre les mises à jour des informations relatives au client conformément au premier alinéa dépend du risque lié à la relation d’affaires et, en tout état de cause, n’excède pas:

> un an, pour les clients présentant un risque plus élevé auxquels s’appliquent les mesures prévues à la section 4 du présent chapitre;

> cinq ans pour tous les autres clients.

Art. 26(3), événements :
> Outre les exigences énoncées au paragraphe 2, les entités assujetties réexaminent et, le cas échéant, mettent à jour les informations relatives au client lorsque:

> les éléments pertinents de la situation d’un client changent;

> elles prennent connaissance d’un fait pertinent qui concerne le client.

(Le point b vise une obligation légale de contacter le client dans l'année, dont la
directive 2011/16/UE.)

Art. 26(4) : vérification régulière des sanctions financières ciblées, et pour les
établissements de crédit et financiers à **chaque nouvelle désignation**. Art.
26(5) : orientations AMLA attendues au 10 juillet 2026. Art. 26(1) : dans un
groupe, on tient compte des autres relations du client dans le groupe (utile en
bancassurance).

Art. 21(3) :
> Les documents, données ou informations détenus par l’entité assujettie sont mis à jour chaque fois que l’exercice de la vigilance à l’égard de la clientèle est réexaminé conformément à l’article 26.

Art. 20(4) :
> Les entités assujetties sont à tout moment en mesure de démontrer à leurs superviseurs que les mesures prises sont appropriées au regard des risques de blanchiment de capitaux et de financement du terrorisme qui ont été identifiés.

Art. 33, vigilance simplifiée (risque faible) :
> réduire la fréquence des mises à jour des données d’identification des clients;

> réduire la fréquence ou le degré d’examen des transactions exécutées par le client;

> les entités assujetties exercent une surveillance suffisante des transactions et de la relation d’affaires pour être en mesure de détecter toute transaction inhabituelle ou suspecte.

Les conditions doivent être revérifiées à intervalles réguliers (33(4)) ; la
simplification cesse notamment en cas de doute, d'incohérence ou si la
surveillance exclut un scénario de risque faible (33(5)).

Art. 76(5), décisions automatisées et IA (extraits) :
> les données traitées par ces systèmes soient limitées aux données obtenues en vertu du chapitre III du présent règlement;

> ou d’augmenter ou de diminuer l’étendue des mesures de vigilance à l’égard de la clientèle appliquées conformément à l’article 20 du présent règlement, fasse l’objet d’une intervention humaine significative afin d’assurer l’exactitude et le caractère approprié d’une telle décision;

> le client puisse obtenir des explications sur la décision prise par l’entité assujettie et puisse contester cette décision

Art. 18(3) : parmi les tâches jamais sous-traitables :
> la décision concernant le profil de risque à attribuer au client;

> l’approbation des critères de détection des transactions et activités suspectes ou inhabituelles.

Assurance-vie : art. 47, les bénéficiaires sont identifiés dès désignation et
leur identité est vérifiée au versement :
> la vérification de l’identité des bénéficiaires et, le cas échéant, de celle de leurs bénéficiaires effectifs intervient au moment du versement des prestations.

**Correction importante** : cela vise les **bénéficiaires** et leur identité. Ce
n'est ni une mise à jour périodique du preneur, ni une vérification d'adresse. Le
contrôle avant paiement ne remplace donc pas le 26(2). Art. 21(1) permet de
suspendre les paiements tant que la vigilance n'est pas satisfaite ; art. 44
impose la détection PPE du bénéficiaire au plus tard au versement ou à la cession.

Autres : art. 34 (vigilance renforcée), art. 69(2) (la suspicion s'apprécie au
regard de tout fait connu, dont le profil de risque), art. 76(4) (pas d'usage
commercial des données traitées sur cette base), art. 77(3) (conservation 5 ans
après la fin de la relation), art. 10(1) (évaluer le risque avant d'utiliser de
nouvelles technologies), art. 90 :
> Il est applicable à partir du 10 juillet 2027

(10 juillet 2029 pour les entités de l'art. 3, points 3) n) et o)).

### 2.2 RTS vigilance (art. 28) : rapport final AMLA du 30 septembre 2026 [Projet]

Transmis à la Commission ; **je n'ai trouvé aucune adoption au 27/11/2026**.

- L'article 23 du projet consulté (février 2026) encadrait exactement la réduction
  de fréquence en risque faible : surveiller qu'aucune circonstance n'a changé,
  qu'aucun événement n'impose une mise à jour et qu'aucune opération suspecte ou
  incohérente n'apparaît, puis : « In any case, obliged entities shall update the
  customer identification data in accordance with Article 26(2), point (b) ».
- Des répondants ont demandé de pouvoir s'appuyer sur la surveillance
  automatisée et événementielle sans solliciter le client, et des cycles de plus
  de 5 ans. Réponse de l'AMLA (p. 50 du rapport, page 51 du PDF) : « The draft RTS cannot
  create derogations from the AMLR ». L'article 23 est supprimé comme redondant :
  « As the periods between updates of customer information are determined by the
  AMLR, they cannot be amended or extended through RTS provisions. »
  [Analyse : l'AMLA refuse l'allongement et la dérogation ; elle ne dit **pas**
  qu'une mise à jour exige toujours un contact.]
- **Stock existant** (art. 28 du projet) : « the documents, data and information
  relating to those customers shall be brought in line with the requirements of
  this Regulation and Regulation (EU) 2024/1624 on a risk-sensitive basis within
  the periods set out in Article 26(2) ». Selon le considérant 26, les délais de
  1 et 5 ans ne courent, pour les relations antérieures, qu'à partir de l'entrée en
  vigueur du règlement délégué. Application du RTS : six mois après.

**Conséquence** : pour le stock, une mise en conformité *unique* est prévue (données
nouvelles de l'art. 22 et du RTS). « Je ne remédie pas » ne peut pas viser cela ;
on peut seulement l'étaler selon le risque et l'automatiser autant que possible.

### 2.3 Lignes directrices surveillance continue (art. 26(5)) [Projet]

Consultation du 3 juin au 3 septembre 2026. Finalisation annoncée pour le 4e
trimestre 2026 ; au 10 novembre, l'AMLA indique avoir révisé le texte à la lumière
de 174 réponses, qui demandaient notamment plus de clarté sur les revues, avec un
renforcement de la supervision humaine ; **pas encore publié** (recherche du
27/11/2026). Tout ce qui suit peut changer.

| § | Contenu | Effet sur l'idée |
|---|---|---|
| 2 | Une revue anticipée peut remettre le compteur à zéro. | Favorable : revues déclenchées ou annuelles. |
| 3, 21 | La revue détermine quels éléments doivent être mis à jour, selon l'information déjà disponible et son ancienneté. | **Principal point d'appui.** |
| 12 | Sources de mise à jour : registres, fournisseurs et sources ouvertes, **confirmation du client**, autres entités assujetties, combinaison. | Les transactions internes **n'y figurent pas**. |
| 14 | Selon le risque, vérifier la fiabilité d'une confirmation du client. | Confirmation en application : possible, à calibrer. |
| 16-18 | Pièce expirée : pas de recollecte automatique, décision fondée sur le risque. | Favorable. |
| 19 | « Periodic reviews must always be conducted in accordance with Article 26(2) of AMLR. » | **Défavorable à « pas de revue ».** |
| 20 | Risque faible, activité inchangée : revue allégée, par exemple registres et sources fiables, filtrage PPE et presse, examen interne de l'objet de la relation. | Favorable à une revue légère ; l'exemple inclut des **sources externes**. |
| 22 | L'historique des transactions peut servir à vérifier que l'**origine des fonds** reste cohérente. | Appui limité à cette donnée. |
| 30-32 | Sans réponse : restriction temporaire possible, puis fin de relation ; l'absence de transactions n'élimine pas le risque. | Le repli a un coût client. |
| 54-55 | Groupes de pairs : ils soutiennent mais ne remplacent pas la compréhension individuelle ; l'absence d'écart au niveau du groupe ne suffit pas à écarter un indice individuel. | **Une cohorte ne peut pas être le motif de la décision.** |
| 78-79 | Clôtures automatiques sous contrôle humain et échantillonnage. | Cadre de contrôle. |
| 87-95 | IA : explicable, contestable, dérive suivie, responsabilité conservée. | Cadre de contrôle. |

La **Fédération bancaire européenne** (3 septembre 2026) demande presque votre
idée : revue réputée satisfaite par la surveillance continue, avec pour le risque
faible sans déclencheur une revue qui « may be conducted through an automated
recertification process », sans contact client inutile, à partir de sources
fiables et de données internes. C'est une **demande**, pas le droit. Le texte final
AMLA dira si elle est retenue : **c'est le point à surveiller en priorité.**

### 2.4 Régime belge actuel (jusqu'à l'AMLR) et BNB

- Loi du 18 septembre 2017, art. 35 §1er, 2° (lu sur etaamb, copie non officielle,
  à confirmer sur Justel) : « la tenue à jour des données détenues conformément aux
  sections 2 et 3 », notamment quand des éléments pertinents pour l'évaluation
  individuelle du risque sont modifiés. Pas de délai chiffré dans ce passage.
- BNB, commentaires sur la vigilance continue (page sans date, consultée le
  27/11/2026) : l'établissement peut juger utile de réexaminer périodiquement,
  surtout en risque élevé ; cela ne le dispense pas d'actualiser avant la
  prochaine revue prévue « if it knows or cannot be unaware that » une donnée
  pertinente a changé. Aucun intervalle chiffré sur les pages lues.
- **À double tranchant** [Analyse] : plus vous collectez de signaux, plus vous
  « ne pouvez ignorer ». Un signal détecté et non traité est pire que pas de
  signal.
- Les plafonds 1 an / 5 ans arrivent avec l'AMLR (10 juillet 2027).

### 2.5 ABE, GAFI

- ABE, orientations sur les facteurs de risque (EBA/GL/2021/02, version consolidée
  de 2023), § 4.41, régime actuel : on peut ne revoir qu'en cas de déclencheur,
  mais « firms must make sure that this does not result in a de facto exemption
  from keeping CDD information up-to-date ». C'est le meilleur résumé de la limite.
- GAFI, recommandation 10 et note interprétative : vigilance continue, données
  tenues à jour, moindre fréquence possible en risque faible. **[Non vérifié à la
  source]** : le site GAFI et la copie du Conseil de l'Europe ont refusé l'accès
  (403) ; repris d'une source secondaire. Aucune reconnaissance officielle du
  « perpetual KYC » comme substitut trouvée.

---

## 3. Votre hypothèse centrale

> Données d'entrée en relation + présomption que les données de base ne changent
> pas + vérification seulement quand le comportement transactionnel s'écarte de
> l'attendu. Pas de dépendance à des registres externes.

Les registres externes ne sont traités ici que comme **scénario de comparaison**.
Une exception ne dépend pas de nous : **sanctions et PPE** supposent des listes
(art. 20(1)(d) et (g), 26(4)) et restent hors hypothèse.

### 3.1 Ce que les transactions prouvent vraiment [Analyse]

| Donnée | Les transactions apportent | Ce qui peut changer sous un comportement stable |
|---|---|---|
| Origine des fonds | **Preuve utile** : même payeur de salaire ou de pension (§22) | Revenu annexe passant ailleurs ; fonds tiers noyés dans les flux habituels |
| Profession / employeur | **Preuve partielle** : salaire du même employeur | Changement de fonction ; mandat non rémunéré ; activité accessoire |
| Objet et nature de la relation | **Preuve utile** : usage conforme du produit | Compte utilisé à la marge pour un tiers (mule discrète) |
| Pays de résidence | **Indice** : géographie des paiements par carte, connexions | Expatrié qui garde compte, salaire et habitudes en ligne |
| Adresse de résidence | **Presque rien** : zone de dépense au mieux | Déménagement dans la même région, séparation, hébergement |
| Noms | **Presque rien** : nom saisi par le payeur | Changement de nom |
| Nationalités | **Rien** | Acquisition ou perte d'une nationalité |
| Date et lieu de naissance, n° national | **Rien** (immuables : le seul risque est une erreur initiale) | Erreur ou fraude à l'entrée jamais redécouverte |
| Identifiant et résidence fiscale | **Rien** de fiable | Nouvelle résidence fiscale |
| Personne qui utilise réellement le compte, client en vie | **Ambigu** : les ordres automatiques continuent | Décès avec virements permanents ; proche qui utilise la carte ; prise de contrôle |
| PPE, proche d'une PPE | **Rien** | Élection, nomination, mariage |
| Sanctions | **Rien** | Nouvelle désignation |
| Assurance-vie à prime automatique | **Rien** : le prélèvement tourne quoi qu'il arrive | Tout |
| Assurance-vie à prime unique, sans interaction | **Aucune transaction** | Tout |

### 3.2 « Stable » ne veut pas dire « inchangé »

Un signal n'apporte de l'information que s'il est **plus probable quand la donnée
est inchangée que quand elle a changé** (rapport de vraisemblance, RV) :

    cotes après = cotes avant × RV      RV = P(signal | inchangé) / P(signal | changé)

*(illustratif)* Adresse avec 8 % de changements par an : après 5 ans sans autre
preuve, la probabilité qu'elle soit toujours bonne n'est plus que de 66 %.

- Comportement stable chez 97 % des inchangés et 95 % des déménagés : RV = 1,02,
  on reste à 66,5 %. **La stabilité n'a rien appris.**
- Signal qui discrimine (95 % contre 30 %) : RV = 3,2, on monte à 86 %.

La confiance vient donc surtout du **taux de base** et du temps écoulé :

| Taux annuel *(illustratif)* | 1 an | 3 ans | 5 ans |
|---|---|---|---|
| 0,5 % (nationalité) | 99,5 % | 98,5 % | 97,5 % |
| 2 % | 98 % | 94 % | 90 % |
| 8 % (adresse) | 92 % | 78 % | 66 % |

Ces taux doivent être **mesurés** chez vous (section 5.2), pas supposés.

### 3.3 « Présumé inchangé » vaut-il « tenu à jour » (art. 26(2)) ?

**Arguments pour**
1. Le texte exige un résultat (données tenues à jour) et une période maximale ; il
   n'impose ni contact client ni nouveau document.
2. Art. 20(2) : l'étendue des mesures suit une analyse individuelle du risque ;
   art. 33(1)(b) réduit la fréquence en risque faible.
3. Projet de lignes directrices § 3, 19-21 : la revue décide quels éléments
   nécessitent une mise à jour, en tenant compte de l'information disponible.
4. La plupart des données d'identification sont immuables ou très stables.
5. Minimisation (RGPD art. 5(1)(c)) : ne pas recollecter sans besoin.
6. Solliciter tout le monde produit des non-réponses et peu d'information.

**Arguments contre**
1. **Effet utile** : le 26(3) impose déjà la mise à jour sur événement, et le
   26(2) ajoute un plafond « en tout état de cause ». Si l'absence d'événement
   suffisait, le plafond ne servirait à rien. C'est l'argument le plus fort.
2. « La période entre les **mises à jour** » suppose un acte daté. Ne rien
   constater n'est pas un acte.
3. Art. 21(3) : les données sont mises à jour à chaque réexamen.
4. Projet § 12 : les sources de mise à jour n'incluent pas le silence ni les
   transactions internes.
5. Projet § 19 : la revue périodique a toujours lieu.
6. AMLA (RTS) : pas de dérogation ni d'allongement.
7. ABE § 4.41 : pas d'exemption de fait. RGPD art. 5(1)(d) : données exactes.
8. Statistiquement, pour une donnée volatile, la présomption se trompe souvent.

**Mon verdict [Analyse]**
- La présomption **seule**, sans acte, ne remet **jamais** le compteur à zéro.
- La variante « je ne vérifie que sur écart TBM » ne satisfait pas le 26(2).
- Une **revue automatisée et documentée**, qui statue élément par élément et
  conclut « pas de mise à jour nécessaire » avec ses motifs, est **plaidable** pour
  des données immuables ou très stables d'un client à risque faible. Incertitude
  **élevée** pour l'adresse et toute donnée volatile sans preuve positive.
- Au moins une **preuve positive peu coûteuse tous les 5 ans** change la solidité
  du dossier : une confirmation « vos données sont-elles toujours exactes ? » dans
  l'application après authentification forte. C'est une confirmation du client
  (§ 12(c)), donc compatible avec votre hypothèse « sans registre externe ».
  Elle doit afficher les valeurs, exiger un geste actif (pas de case précochée),
  et être tracée. Sa fiabilité se mesure aussi.

### 3.4 Art. 26(3) : l'écart TBM n'est qu'un déclencheur

Il faut aussi brancher : changements signalés au guichet, au service client ou par
un autre métier du groupe ; courriers retournés ; courriels rejetés ; demandes de
la CTIF ou judiciaires ; presse négative ; liste PPE et sanctions ; nouveau
produit ; obligation annuelle de contact (point b) ; décès ; majorité ; cession,
rachat ou versement exceptionnel en assurance-vie. Un fait connu impose le
réexamen, même si les transactions sont parfaitement stables.

### 3.5 Formulations

| À ne pas dire | Défendable |
|---|---|
| « Nous ne faisons plus de revue périodique. » | « Chaque client est revu au plus tard tous les 5 ans ; la revue est automatisée quand la preuve suffit. » |
| « Un client stable est à jour. » | « La stabilité est un indice dont nous mesurons la valeur, donnée par donnée. » |
| « Le TBM remplace la mise à jour. » | « Le TBM alimente la mise à jour et déclenche les réexamens. » |
| « La cohorte est à faible risque, donc le client aussi. » | « La cohorte sert au pilotage ; la décision est individuelle. » |
| « L'IA décide qu'il n'y a rien à faire. » | « Le modèle propose ; un humain responsable décide et peut contester. » |

---

## 4. Méthode

### 4.1 Catalogue des données *(tous les chiffres sont illustratifs)*

Confiance : `c(t) = r × (1 − h)^t`, puis mise à jour des cotes par le RV des
signaux. `h` taux annuel de changement, `t` années depuis la dernière preuve
positive, `r` fiabilité de cette preuve. Demi-vie = `ln 0,5 / ln(1 − h)`.

| Donnée | h / demi-vie | Preuves internes | Scénario avec source externe | Seuil | Sous le seuil |
|---|---|---|---|---|---|
| Noms | 0,3 % / 230 ans | pièce initiale, eID, confirmation | registre national | 0,95 | confirmation |
| Naissance, n° national | erreur seulement | contrôle initial, eID | registre national | 0,98 | recontrôle du dossier |
| Nationalité(s) | 0,5 % / 138 ans | confirmation | registre | 0,95 | confirmation |
| Adresse | 8 % / 8 ans | confirmation, courrier retourné, livraison de carte | registre | 0,90 | confirmation puis preuve |
| Pays de résidence | 1 % / 69 ans | cartes, connexions, confirmation | registre | 0,95 | contact |
| Résidence fiscale | 1 % / 69 ans | autocertification | selon accès | 0,95 | autocertification |
| Profession / employeur | 10 % / 7 ans | salaire, pension, confirmation | aucune supposée | 0,80 | question ciblée |
| Objet de la relation | 5 % / 14 ans | usage du produit | aucune | 0,85 | revue humaine |
| Origine des fonds | 5 % / 14 ans | même payeur (§22) | aucune | 0,85 | justificatif si inexpliqué |
| Contrôle du compte, en vie | 1 % / 69 ans | authentification forte, eID | registre (décès) | 0,95 | réauthentification, contact |
| PPE | listes | **filtrage obligatoire** | listes | sans objet | revue renforcée |
| Sanctions | listes | **filtrage obligatoire** | listes | sans objet | gel selon les règles |
| Pièce d'identité | date connue | échéance enregistrée | registre | risque (§16-18) | recollecte si utile |

Les accès aux registres (dont l'accès indirect au Registre national évoqué par la
BNB pour la vérification d'identité) et leur usage en mise à jour sont à valider.
La maquette simplifie : un seul seuil réglable (80 % par défaut) pour toutes les
données, et la date de naissance tenue pour prouvée dès l'entrée en relation.

### 4.2 États et deux horloges

- **Confirmée** : preuve positive datée, d'une source acceptée.
- **Actualisée** : valeur changée et vérifiée selon le risque.
- **Présumée inchangée** : pas de preuve nouvelle, confiance ≥ seuil, aucune
  contradiction.
- **À vérifier** : confiance < seuil ou contradiction.

**Horloge de preuve** (statistique, par donnée) et **horloge légale** (date de la
dernière revue documentée). Politique **stricte** : seule une preuve positive
satisfait la revue. Politique **présomption admise à la revue** (contestée) : la
revue peut clore une donnée présumée si les motifs sont consignés. La maquette
montre l'écart entre les deux. Commencez en mode strict.

### 4.3 Cohortes

- **Granularité** : produit × classe de risque × ancienneté × canal × type de
  revenu × richesse des signaux. Assez fine pour que le taux de changement soit
  homogène, assez grosse pour être mesurée (section 5.2 : quelques centaines de
  contrôles par strate). Trop de cohortes = mesure impossible.
- **Éligibilité** : personne physique ; risque faible ; vérification initiale au
  niveau requis (ou stock mis à niveau) ; ancienneté minimale (12 mois,
  *illustratif*) ; activité et authentifications suffisantes ; aucune alerte
  ouverte.
- **Exclusions** : PPE, proches et personnes associées (art. 42-46) ; pays tiers
  des art. 29-31 ; toute vigilance renforcée ; situations de l'art. 33(5) ;
  déclaration ou analyse en cours (sans le révéler au client, art. 73) ; comptes
  dormants sans signal ; personnes morales (hors pilote).
- **Déclencheurs** : section 3.4, plus tout écart TBM individuel.
- **Expiration avant le plafond** *(illustratif)* : T-12 mois, revue
  automatisée ; T-9, confirmation en application ; T-6, courrier ; T-3, revue
  manuelle ; avant T, restriction proportionnée puis, à défaut, fin de relation
  (§30-32, art. 21), sans préjudice des règles sur le service bancaire de base.
- **Aucun glissement** : une revue en retard est une violation, pas un arriéré.

### 4.4 Assurance-vie, le cas difficile

Peu ou pas de transactions, contrats longs, interactions rares. Un prélèvement
stable n'apprend rien. L'absence d'activité n'élimine pas le risque (§31). Pistes :

1. relevé annuel avec confirmation active (portail ou coupon) ;
2. événements : rachat, avance, versement exceptionnel, changement de payeur ou de
   bénéficiaire, cession (art. 47), courrier retourné ;
3. en groupe, signaux de la relation bancaire du même client (art. 26(1)), sous
   réserve RGPD et art. 76(4) ;
4. avant 5 ans sans réponse : revue humaine ; le blocage d'un paiement (art.
   21(1)) est un dernier recours, **pas** une méthode de mise à jour.

N'incluez pas les contrats dormants dans le premier pilote.

### 4.5 Où l'IA aide, où elle ne décide pas seule

**Utile** : regrouper (clustering) pour proposer des cohortes ; détecter des
anomalies individuelles ; lire des documents, courriers retournés et messages ;
estimer les taux de changement ; prioriser les contrôles ; préparer le dossier.

**Jamais seule** : attribuer le profil de risque (non sous-traitable, 18(3)(c)) ;
approuver les critères de détection (18(3)(f)) ; augmenter ou réduire la vigilance,
refuser ou rompre la relation (76(5)(b)) ; déclarer à la CTIF.

**Question ouverte majeure** : « pas de contact, revue close » diminue-t-il
l'étendue de la vigilance au sens du 76(5)(b) ? Si oui, « toute décision » exige
une intervention humaine significative. Approuver une règle et contrôler un
échantillon **pourrait ne pas suffire** pour des centaines de milliers de
clôtures. À trancher avant d'investir.

**Données** : 76(5)(a) les limite à celles obtenues au titre du chapitre III. Les
connexions et appareils ne sont pas acquis ; le projet de lignes directrices les
cite comme signaux (§27(b), §44(a)), ce qui aide sans régler la question.

---

## 5. Cadre de contrôle

### 5.1 Validation du modèle
Documenter données, hypothèses, seuils ; tester sur historique et données
synthétiques ou anonymisées (§82) ; rechercher les changements manqués, pas
seulement comparer à l'ancien processus (§85) ; validation indépendante et audit
(art. 9(2)(b)) ; critères et profil de risque approuvés en interne.

### 5.2 Groupe de contrôle

Chaque trimestre, tirer **au hasard** dans chaque strate, parmi les clients
classés « présumés inchangés », un échantillon vérifié **intégralement** par un
humain : contact, pièce, eID ; les registres peuvent servir d'**instrument de
mesure** même si la production ne s'y appuie pas. Mesure : part des clients avec
au moins un changement **matériel** non détecté, et part par donnée.

**Taille.** Pour démontrer, à 95 % de confiance (borne unilatérale), que le taux
est sous un plafond `p` avec au plus `c` changements trouvés, on cherche le plus
petit `n` tel que P(X ≤ c | n, p) ≤ 5 % (loi binomiale). Avec c = 0 :
`n = ln 0,05 / ln(1 − p)` (environ 3/p).

Plafond de 2 % *(illustratif, à fixer par la direction)* :

| Changements tolérés c | 0 | 1 | 2 | 3 | 5 |
|---|---|---|---|---|---|
| n minimal | 149 | 236 | 313 | 386 | 523 |

Un petit échantillon pénalise aussi un bon processus : avec n = 386 et c = 3, si
le vrai taux est 0,5 %, on réussit 87 % du temps ; à 1 %, 46 % seulement.

Pour **estimer** un taux : `n = 1,96² p(1−p) / e²` ; p = 1 % à ± 0,5 point : 1 522.

**Exemple** *(illustratif)* : 1 200 vérifiés, 14 changements. Taux observé 1,17 % ;
borne supérieure exacte à 95 % : 1,82 %. Sous le plafond de 2 %.

**Non-réponses.** Si ces 1 200 réponses viennent de 1 500 tirés, les 300 muets sont
probablement ceux qui ont le plus changé. Scénario prudent (tous changés) :
314 / 1 500 = 20,9 %, borne 22,7 % : **la démonstration s'effondre**. Il faut
obtenir la vérité par un second canal et publier le taux de réponse.

**Test de réfutation, annoncé à l'avance.** Mesurer aussi les clients signalés par
le TBM. Si leur taux de changement n'est pas nettement supérieur à celui des
clients stables, la stabilité ne discrimine pas : **on abandonne la présomption**
pour cette donnée. Pour distinguer 2 % de 4 % (puissance 80 %, risque 5 %
bilatéral) : environ 1 141 contrôles par groupe.

Les calculs portent sur une strate et un indicateur ; multiplier les strates
multiplie l'effort et les faux succès.

### 5.3 Dérive et seuils d'arrêt
Suivre par mois : taux de signaux, couverture par donnée, courriers retournés,
réponses, taux du groupe de contrôle, déclarations CTIF issues de la cohorte,
changements découverts hors modèle. Suspendre la clôture automatique d'une strate
si la borne dépasse le plafond, si un changement de produit ou de source survient,
ou si les données se dégradent.

### 5.4 Explicabilité et piste d'audit
Par client et par donnée : valeur, état, preuves (identifiants, dates), confiance,
versions du modèle et des seuils, décision, personne responsable, motif,
contestation éventuelle. Reconstituable à une date donnée ; conservation selon
l'art. 77.

### 5.5 RGPD et règlement IA [Analyse]
- Base : obligation légale (RGPD art. 6(1)(c)) dans la limite du nécessaire ;
  finalité AML seule (art. 76(4)) ; minimisation et exactitude (art. 5(1)(c)-(d)).
- Art. 22 : une restriction de compte décidée sans humain serait en cause ; prévoir
  intervention humaine, explication et contestation (aussi art. 76(5)(b)-(c) AMLR ;
  l'exception à l'explication vise la déclaration de l'art. 69).
- Analyse d'impact (art. 35) très probablement nécessaire ; consulter le DPO.
- Règlement (UE) 2024/1689 : ni le blanchiment ni la surveillance des transactions
  ne figurent à l'annexe III (page de la Commission consultée ; le point 5(b)
  exclut la détection de fraude financière de la catégorie notation de crédit).
  La classification, les obligations générales (culture IA, transparence) et le
  calendrier modifié en 2026 **[non vérifié]** sont à confirmer.

---

## 6. Dialogue avec la BNB

### 6.1 La phrase défendable

> Pour un périmètre défini de relations à risque faible, nous ne menons plus de
> campagne périodique sollicitant systématiquement le client. Chaque relation fait
> l'objet, au plus tard tous les cinq ans, d'une revue documentée, élément par
> élément, outillée et soumise à une intervention humaine significative. Les
> données sont confirmées ou actualisées à partir de sources définies ; le client
> est sollicité quand la preuve manque ou est contredite. Nous mesurons chaque
> trimestre, sur un échantillon aléatoire, le taux de changements non détectés et
> suspendons le dispositif au-delà de X %. Les obligations des art. 26(3) et 26(4)
> restent appliquées en continu.

Ne l'annoncer qu'avec des résultats mesurés. Avant le 10 juillet 2027, le cadre
est la loi de 2017 ; la phrase vise le régime futur.

### 6.2 Dossier de preuves
Évaluation des risques à l'échelle de l'entité mise à jour ; politique et
procédures approuvées ; catalogue des données et seuils justifiés ; éligibilité et
exclusions ; avis juridique et DPO, analyse d'impact ; validation indépendante ;
résultats du mode fantôme ; groupe de contrôle avec non-réponses ; test de
réfutation ; tableau du respect du plafond (zéro dépassement) ; déclencheurs et
délais de traitement ; exemples de dossiers rejouables ; plan de retour en arrière.

### 6.3 Objections probables

| Objection | Réponse honnête |
|---|---|
| « L'art. 26(2) exige une mise à jour. » | Il y a une revue datée par client ; nous montrons ce qu'elle constate. Point de droit ouvert. |
| « L'absence de signal ne prouve rien. » | Exact pour plusieurs données : preuve positive requise, valeur du signal mesurée. |
| « Vos cohortes effacent l'individu. » | Décision individuelle ; cohorte pour le pilotage (§54-55). |
| « Un client peut devenir PPE sans changer de comportement. » | Filtrage sur listes, indépendant du modèle. |
| « Décès, mules, expatriés. » | Authentification, signaux dédiés, taux mesuré ; risque résiduel chiffré. |
| « Boîte noire. » | Règles lisibles par donnée, rejouables. |
| « Qui décide ? » | Responsable nommé, intervention humaine, pas de sous-traitance du profil de risque. |
| « Et vos non-répondants ? » | Rapportés séparément ; second canal ; restriction puis sortie. |

### 6.4 Pilote par étapes *(calendrier illustratif)*

| Phase | Contenu | Passage à la suite si |
|---|---|---|
| 0, T1 2027 | Avis juridique, lecture des lignes directrices finales et du RTS adopté, qualité des données | Pas d'obstacle bloquant |
| 1, 6 mois, **mode fantôme** | Le modèle propose, rien ne change ; les revues actuelles continuent et servent de vérité | Taux sous le plafond, test de réfutation réussi |
| 2, 6-12 mois | Une cohorte (salariés actifs), mode strict avec confirmation en application ; contact BNB en amont | Plafond respecté, aucune échéance manquée |
| 3 | Extension strate par strate ; assurance-vie en dernier | Contrôle trimestriel stable, audit favorable |

Arrêt immédiat : borne au-dessus du plafond, échéance dépassée, changement matériel
systématiquement manqué, texte final contraire.

---

## 7. Hypothèses, questions ouvertes, juriste

### Points faibles de l'idée
1. Le gain porte sur le **contact et le travail manuel**, pas sur l'existence d'une
   revue ni sur le plafond.
2. Les transactions ne prouvent presque rien sur l'identité, l'adresse, la
   nationalité, le statut PPE.
3. La population la plus facile à automatiser (stable, active) répondrait aussi à
   une confirmation en application : le TBM sophistiqué apporte peu **pour la mise
   à jour** ; sa valeur est dans la détection.
4. La population difficile (dormants, vie) n'a pas de signal.
5. Intervention humaine de l'art. 76(5)(b) à grande échelle.
6. Mesurer coûte des contrôles manuels en continu et dépend des réponses.
7. Le stock devra être mis à niveau (RTS, projet).
8. Textes de niveau 2 et 3 non finalisés.

### Hypothèses de travail
Détail de détail (particuliers, preneurs d'assurance-vie) ; authentification forte
disponible ; salaires identifiables ; historique exploitable ; filtrage existant.

### À faire vérifier par un juriste
1. Une revue automatisée concluant « aucun changement » est-elle une « mise à
   jour » au sens du 26(2) ? Pour quelles données ?
2. Quelles données sont « pertinentes » (26(2)) ?
3. Portée du 76(5)(b) : décision par décision ou par règle ?
4. Connexions, appareils, géographie des paiements : données « du chapitre III » ?
   Compatibilité RGPD et secret ; usage intragroupe banque et assurance.
5. Point de départ des délais pour le stock si le RTS tarde ou change.
6. Sens exact de « clients présentant un risque plus élevé auxquels s'appliquent les
   mesures prévues à la section 4 » : traitement des clients à risque accru.
7. Restriction ou rupture après non-réponse : droit belge, service bancaire de
   base, règles propres à l'assurance-vie (dont contrats dormants).
8. Accès et usage du Registre national pour la mise à jour (scénario externe).
9. Droit belge après le 10 juillet 2027 : abrogations, circulaires BNB nouvelles.
10. Lire les versions **finales** (lignes directrices 26(5), RTS 28(1), orientations
    art. 20(3)) avant toute promesse.

---

## Sources (consultées les 26 et 27 novembre 2026)

- AMLR, règlement (UE) 2024/1624, 31 mai 2024 : `docs/data/laws/32024R1624_FR.json`
  et `_EN.json` ; <https://eur-lex.europa.eu/eli/reg/2024/1624/oj>
- RGPD : `docs/data/laws/32016R0679_FR.json`
- AMLA, rapport final RTS art. 28(1), 30 septembre 2026 :
  <https://www.amla.europa.eu/document/download/e15ab2e5-4074-4de8-bb9d-613dd8b7fdd1_en?filename=Final%20Report%20-%20draft%20RTS%2028%281%29%20AMLR.pdf>
- AMLA, consultation RTS, 9 février 2026 :
  <https://www.amla.europa.eu/document/download/3d430294-5171-455c-b565-a86fc5f3cb1c_en?filename=Consultation+Paper+Draft+RTS+under+Article+28%281%29.pdf>
- AMLA, consultation lignes directrices art. 26(5), 3 juin 2026 :
  <https://www.amla.europa.eu/document/download/46b50078-08ed-4ab1-aea0-28b1a6085755_en?filename=Consultation%20Paper%20-%20Article%2026%285%29%20AMLR.pdf>
- AMLA, discours R.-L. Ørum Petersen, 10 novembre 2026 :
  <https://www.amla.europa.eu/document/download/c560bd93-e189-4726-a352-5d84b135c289_en?filename=20261110+Speech+at+AMLP+forum+-+EBM+Petersen.pdf>
- FBE, réponse du 3 septembre 2026 :
  <https://ebf.eu/sites/default/files/wpuploads/2026/09/EBF-Response-to-AMLA-Draft-GLs-on-Ongoing-monitoring.pdf>
- ABE, EBA/GL/2021/02 consolidées :
  <https://www.eba.europa.eu/sites/default/files/document_library/Publications/Guidelines/2023/EBA-GL-2023-03/1061654/Guidelines%20ML%20TF%20Risk%20Factors_conslidated.pdf.pdf>
- BNB, vigilance continue :
  <https://www.nbb.be/en/financial-supervision/aml/information-and-recommendations/customer-and-transaction-due-diligence/due-diligence-business-relationships-and-occasional-transactions-and-detection-0>
- BNB, identification :
  <https://www.nbb.be/en/financial-supervision/aml/information-and-recommendations/customer-and-transaction-due-diligence/identification-and-identity-verification/object-identification-and-identity-0>
- Loi du 18 septembre 2017 (copie) :
  <https://etaamb.openjustice.be/fr/loi-du-18-septembre-2017_n2017013368.html>
- Règlement IA, annexe III : <https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3>
- EY, 8 novembre 2024 (pratique) :
  <https://ey.com/en_us/insights/financial-services/kyc-refresh-effective-risk-based-program>
- GAFI R.10, source secondaire [non vérifié] :
  <https://financialcrime.lu/col_slider/2025-11-15-FATF-Recommendation-10/>
