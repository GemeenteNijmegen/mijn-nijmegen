# Opzet Mijn Nijmegen

De applicatie is opgebouwd uit een set Lambda functies die aanroepbaar zijn via een API Gateway die gekoppeld is aan een Cloudfront distributie:

![Mijn Nijmegen architectuurplaat](assets/mijnnijmegen.drawio.svg)

Authenticatie gaat via het OpenIDConnect-protocol, via https://authenticatie.nijmegen.nl. De /login en /auth routes zijn hiervoor verantwoordelijk.

## Installatie
Om de eerste keer te installeren moet een handmatige deploy gedaan worden. Zorg dat je naar de deployment-account deployt. Vanuit daar worden afhankelijk van de gekozen branch in de juiste account resources aangemaakt. Let op dat je environment de juiste branch moet hebben. Daarnaast moet je bij de eerste deploy de arn van de codestarConnection naar Github meegeven. Een voorbeeld:
``` 
export BRANCH_NAME=acceptance
export AWS_PROFILE=deployment
cdk deploy --parameters connectionArn=<arnvancodestarconnection>
```
Vervolgens worden wijzigingen in de verbonden repository in de gekoppelde branche door de pipeline opgepakt.

## Afhankelijkheden
Aan de bestaande API Gateway kunnen nieuwe routes gekoppeld worden in externe projecten. Een voorbeeld is [Mijn Uitkering](https://github.com/gemeenteNijmegen/mijn-uitkering). Dit project is verder afhankelijk van een bestaande DNS Zone in AWS.

## Github workflows
Om de workflows (build, selfmutate, upgrade) te kunnen draaien is een token nodig met de naam PROJEN_GITHUB_TOKEN. Zie https://docs.github.com/en/actions/security-guides/automatic-token-authentication#granting-additional-permissions voor meer details.