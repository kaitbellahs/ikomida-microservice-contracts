import {
  bundle,
  cryptPassword,
  signData,
  Logics,
  validateSignature,
  Types,
  GateWays,
  Utils,
  DBModels,
  BackendTypes,
  Domain
} from '@ikomida/shared-backend'
import crypto from 'crypto'

const host: any = {
  development: 'https://dev.ikomida.com/',
  homologation: 'https://hmlg.ikomida.com/',
  production: 'https://ikomida.com/'
}

export default class Contracts {
  paymentGateway?: GateWays.Asaas
  randCodes: Utils.RandCodes
  logger: Utils.Logger
  bannedNames = [
    'ikomida',
    'tialtonivel',
    'Khalid',
    'Khalid-ait',
    'Khalid-ait-Bellahs',
    'Khalid-bellahs',
    'ait-bellahs',
    'bellahs',
    'kaitbellahs',
    'kbellahs',
    'vendor',
    'client',
    'user',
    'reseller',
    'admin',
    'manager'
  ]
  host: string

  constructor(logger: Utils.Logger) {
    this.logger = logger
    this.host = host[process.env.NODE_ENV ?? 'development']
    this.paymentGateway = new GateWays.Asaas(this.logger)
    this.randCodes = new Utils.RandCodes()
  }

  async createPhoneValidation(input: any) {
    try {
      const payload: Types.Classes.CContract = Types.Classes.CContract.fromObject(input)
      if ((payload.contractName?.length ?? 0) <= 2) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_NAME)
      }
      if (!Logics.Validations.validateUUID(payload.termId)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_TERM)
      }
      if ((payload.name?.length ?? 0) <= 2) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_NAME)
      }
      if ((payload.lastName?.length ?? 0) <= 2) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_LAST_NAME
        )
      }
      if (!Logics.Validations.validateCNPJ(payload.contractIdentity)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_CPF)
      }
      if (!Logics.Validations.validateCPF(payload.identity)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_CPF)
      }
      if (!Logics.Validations.validateEmail(payload.email)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_EMAIL)
      }
      if (!Logics.Validations.validatePhone(payload.phone)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_PHONE)
      }
      if (!Logics.Validations.validatePassword(payload.password)) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_PASSWORD
        )
      }
      const [validateAddressCode] = Logics.Validations.validateAddress(payload.address)
      if (!validateAddressCode) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_PASSWORD
        )
      }
      const ikomidaID = `com.ikomida.br.${bundle(payload.contractName ?? '')}`
      const role = BackendTypes.Roles.VENDOR
      const plan = await this.selectPlan(payload)
      if (!plan) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_OBJECT_OR_PLANE_MODIFIED)
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID
        }
      })
      if (contractModel) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_CREATE_PHONE_VALIDATION_INVALID_CONTRACT
        )
      }
      const code = Logics.Finances.pad(Math.ceil(Math.random() * 10000), 4)
      payload.phoneValidationCode = code
      const signatureObject = payload.toJSON()
      delete signatureObject.signature
      delete signatureObject.payment
      const signature = await signData(signatureObject)
      const validationObject = {
        role,
        code,
        signature
      }
      const phoneValidationCodeModel = await DBModels.PhoneValidationCodeModel.create(validationObject)
      const message = new Utils.SMS(Utils.SMS.VALIDATION_CODE, code, 'iKomida')
      const smsPayload = new Types.Classes.CAMQPPayload<Types.Classes.CAMQPPayloadObject>()
      smsPayload.method = 'send'
      smsPayload.object = new Types.Classes.CAMQPPayloadObject()
      smsPayload.object.areaCode = String(payload.areaCode)
      smsPayload.object.phone = payload.phone
      smsPayload.object.message = message
      const amqp = new Domain.RabbitMQ(this.logger)
      await amqp?.publish<Types.Classes.CAMQPPayloadObject>(Domain.RabbitMQ.SMS_QUEUE, smsPayload)
      await amqp?.close()
      if (phoneValidationCodeModel) {
        return new Utils.Return(true, signature)
      }
    } catch (exception: any) {
      let error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_CREATE_PHONE_VALIDATION_EXCEPTION,
        exception
      )
      if (exception instanceof Utils.iKomidaError) {
        error = exception
      }
      return error.logAndReturn(this.logger)
    }
    const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_UNKNOWN)
    return error.logAndReturn(this.logger)
  }

  async validatePhoneValidationCode(input: any) {
    try {
      const payload: Types.Classes.CContract = Types.Classes.CContract.fromObject(input)
      if ((payload.contractName?.length ?? 0) <= 2) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_NAME)
      }
      if (!Logics.Validations.validateUUID(payload.termId)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_TERM)
      }
      if ((payload.name?.length ?? 0) <= 2) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_NAME)
      }
      if ((payload.lastName?.length ?? 0) <= 2) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_LAST_NAME
        )
      }
      if (!Logics.Validations.validateCNPJ(payload.contractIdentity)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_CPF)
      }
      if (!Logics.Validations.validateCPF(payload.identity)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_CPF)
      }
      if (!Logics.Validations.validateEmail(payload.email)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_EMAIL)
      }
      if (!Logics.Validations.validatePhone(payload.phone)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_PHONE)
      }
      if (!Logics.Validations.validatePassword(payload.password)) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_PASSWORD
        )
      }
      const [validateAddressCode, validateAddressMessage] = Logics.Validations.validateAddress(payload.address)
      if (!validateAddressCode) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_CREATE_PHONE_VALIDATION_MISSING_PASSWORD,
          validateAddressMessage
        )
      }
      const ikomidaID = `com.ikomida.br.${bundle(payload.contractName ?? '')}`
      const role = BackendTypes.Roles.VENDOR
      const plan = await this.selectPlan(payload)
      if (!plan) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_OBJECT_OR_PLANE_MODIFIED)
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID
        }
      })

      const bannedNames: string[] = JSON.parse(
        (
          await DBModels.SettingModel.findOne({
            where: {
              name: 'bannedNames',
              active: true
            }
          })
        )?.value ?? '[]'
      ) as string[]
      bannedNames.push(...this.bannedNames)
      if (contractModel || bannedNames.includes(bundle(payload.contractName ?? ''))) {
        throw new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_VALIDATE_PHONE_VALIDATION_INVALID_CONTRACT
        )
      }
      const signatureObject = payload.toJSON()
      delete signatureObject.signature
      delete signatureObject.payment
      if (await validateSignature(signatureObject, payload.signature ?? '')) {
        const phoneValidationCodeModels = await DBModels.PhoneValidationCodeModel.findAll({
          where: {
            role,
            code: payload.phoneValidationCode,
            signature: payload.signature
          }
        })
        return new Utils.Return((phoneValidationCodeModels?.length ?? 0) === 1)
      }
    } catch (exception: any) {
      let error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_VALIDATE_PHONE_VALIDATION_EXCEPTION,
        exception
      )
      if (exception instanceof Utils.iKomidaError) {
        error = exception
      }
      return error.logAndReturn(this.logger)
    }
    const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_VALIDATE_PHONE_VALIDATION_UNKNOWN)
    return error.logAndReturn(this.logger)
  }

  async newContact(input: any, ip: string) {
    let transaction: Domain.SqlDB.Transaction | undefined = undefined
    try {
      const payload: Types.Classes.CContract = Types.Classes.CContract.fromObject(input)
      const ikomidaID = `com.ikomida.br.${bundle(payload.contractName ?? '')}`
      const plan = await this.selectPlan(payload)
      const validatePhoneValidationCode = await this.validatePhoneValidationCode(input)
      if (!validatePhoneValidationCode?.success) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_GATEWAY_SERVICE_NEW_USER_INVALID_PHONE_VALIDATION_CODE)
      }
      const termModel = await DBModels.TermModel.findOne({
        where: {
          id: payload.termId,
          active: true
        }
      })
      if (!termModel) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_INVALID_TERM_ID)
      }
      const contractModelCount = await DBModels.ContractModel.count({
        where: {
          ikomidaID
        }
      })
      if (contractModelCount !== 0) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_RESTAURANT_ALREADY_REGISTERED)
      }
      const validity = Logics.Finances.pad(payload.payment?.validity ?? '', 4)
      const subscriptionObject: Types.Classes.Asaas.CAsaasSubscription =
        Types.Classes.Asaas.CAsaasSubscription.fromObject({
          customer: {
            name: `${payload.name} ${payload.lastName}`,
            email: payload.email,
            areaCode: payload.areaCode,
            phone: String(Logics.Finances.toNumber(payload.phone ?? '')),
            identity: String(Logics.Finances.toNumber(payload.identity ?? '')),
            address: {
              postalCode: payload.address?.postalCode,
              name: payload.address?.street,
              number: payload.address?.number,
              complement: payload.address?.complement,
              province: payload.address?.city
            }
          },
          plan: {
            name: plan?.name ?? '',
            price:
              (plan?.price ?? 0) -
              Logics.Finances.calcDiscount(
                plan?.price ?? 0,
                plan?.discount ?? 0,
                plan?.discountType ?? Types.Types.TDiscount.NO
              )
          },
          ikomidaID,
          payment: {
            holderName: payload.payment?.holder,
            number: payload.payment?.number,
            expiryMonth: Number(validity.substring(0, 2)),
            expiryYear: Number(validity.substring(2, 4)),
            ccv: Number(payload.payment?.code)
          },
          externalReference: plan?.name,
          observations: null
        })
      const doRecurringSubscription = await this.paymentGateway?.doRecurringSubscription(subscriptionObject, ip)
      if (
        !doRecurringSubscription?.success ||
        !doRecurringSubscription?.data?.id ||
        doRecurringSubscription?.data.status !== Types.Types.Asaas.TAsaasSubscriptionStatus.ACTIVE
      ) {
        const reason = doRecurringSubscription?.data?.errors?.[0]?.[0]
        throw new Utils.iKomidaError(
          reason?.code === 'invalid_creditCard'
            ? Utils.iKomidaError.IKOMIDA_GENERIC_GATEWAY_ERROR
            : Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_GATEWAY_ERROR,
          reason?.description
        )
      }
      transaction = await Domain.SqlDB.sequelize.transaction({
        autocommit: false
      })
      const contractModel = await plan?.$create<DBModels.ContractModel>(
        'contract',
        {
          ikomidaID,
          contractName: payload.contractName,
          contractIdentity: Logics.Finances.toNumber(payload.contractIdentity),
          email: payload.email,
          cpf: Logics.Finances.toNumber(payload.identity),
          status: Types.Types.TAsaasSignatureStatus.ACTIVE,
          name: payload.name,
          lastName: payload.lastName,
          identity: Logics.Finances.toNumber(payload.contractIdentity),
          areaCode: Logics.Finances.toNumber(payload.areaCode),
          phone: Logics.Finances.toNumber(payload.phone)
        },
        { transaction }
      )
      const contractPaymentSignature = await contractModel?.$create<DBModels.ContractPaymentSignatureModel>(
        'contractPaymentSignature',
        {
          gateway: this.paymentGateway?.name,
          subscriptionID: doRecurringSubscription?.data.id,
          status: doRecurringSubscription?.data.status,
          cycle: doRecurringSubscription?.data.cycle,
          value: Math.ceil((doRecurringSubscription?.data.value ?? 0) * 100),
          cardToken: doRecurringSubscription?.data.creditCard?.creditCardToken,
          number: doRecurringSubscription?.data.creditCard?.creditCardNumber
        },
        { transaction }
      )
      await contractModel?.$create(
        'address',
        {
          kind: Types.Types.TAddress.PROFESSIONAL,
          role: BackendTypes.Roles.VENDOR,
          postalCode: payload.address?.postalCode,
          street: payload.address?.street,
          number: payload.address?.number,
          complement: payload.address?.complement,
          neighborhood: payload.address?.neighborhood,
          city: payload.address?.city,
          distance: 0,
          duration: 0,
          stat: payload.address?.stat
        },
        { transaction }
      )
      const referredByModel = await DBModels.ReferralModel.findOne<DBModels.ReferralModel>({
        where: {
          code: payload.referredBy,
          active: true
        },
        transaction
      })
      if (referredByModel && contractModel) {
        await referredByModel.$add('contracts', contractModel, { transaction })
      }
      const userModel = await contractModel?.$create<DBModels.UserModel>(
        'user',
        {
          avatar: '',
          role: BackendTypes.Roles.VENDOR,
          name: payload.name,
          lastName: payload.lastName,
          email: payload.email,
          identity: Logics.Finances.toNumber(payload.identity),
          phone: Logics.Finances.toNumber(payload.phone),
          areaCode: Logics.Finances.toNumber(payload.areaCode),
          password: (await cryptPassword(payload.password)).hash,
          active: true
        },
        { transaction }
      )
      const referralModel = await contractModel?.$create(
        'referral',
        {
          code: this.randCodes.generateOne()
        },
        { transaction }
      )
      if (referralModel) {
        await userModel?.$set('referral', referralModel, { transaction })
      }
      const termDetails = {
        termId: termModel?.id,
        name: termModel?.name,
        text: termModel?.text,
        type: termModel?.type,
        contract: contractModel?.id,
        user: userModel?.id
      }
      const hash = crypto.createHash('sha256').update(JSON.stringify(termDetails)).digest('base64')
      const termHashModel = await termModel?.$create('termHash', { hash }, { transaction })
      if (contractModel) {
        await contractModel.$add('termHashs', termHashModel, { transaction })
      }
      if (userModel) {
        await userModel.$set('termHash', termHashModel, { transaction })
      }
      this.logger.info(`created new iKomidaID: ${contractModel?.ikomidaID}`)

      await transaction.commit()
      transaction = undefined
      let lastDueDate
      let nextDueDate
      const payments = await this.paymentGateway?.getPayments(doRecurringSubscription?.data.id)
      for (const paymentObject of payments?.data ?? []) {
        try {
          const paymentStatus = paymentObject?.status
          const originalDate = Logics.DateTime?.parseAsaasDate(paymentObject?.dueDate)
          const todayDate = Logics.DateTime?.parseAsaasDate(Logics.DateTime?.localToday())
          const acceptedPaymentStatus =
            paymentStatus &&
            [Types.Types.TAsaasPaymentStatus.PENDING, Types.Types.TAsaasPaymentStatus.CONFIRMED].includes(paymentStatus)
          const pendingStatus = paymentStatus && [Types.Types.TAsaasPaymentStatus.PENDING].includes(paymentStatus)
          if (acceptedPaymentStatus && originalDate <= todayDate && (!lastDueDate || originalDate > lastDueDate)) {
            lastDueDate = originalDate
          }
          if (pendingStatus && originalDate > todayDate && (!nextDueDate || originalDate < nextDueDate)) {
            nextDueDate = originalDate
          }
        } catch (exception: any) {
          const error = new Utils.iKomidaError(
            Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_NEW_CONTRACT_EXCEPTION,
            exception
          )
          error.log(this.logger)
        }
      }
      if (lastDueDate && contractPaymentSignature) {
        contractPaymentSignature.lastDueDate = lastDueDate
      }
      if (nextDueDate && contractPaymentSignature) {
        contractPaymentSignature.nextDueDate = nextDueDate
      }
      await contractPaymentSignature?.save()
      await contractModel?.$create('vendorSettings', {
        restaurantImage: '',
        contractName: payload.contractName,
        contractIdentity: Logics.Finances.toNumber(payload.contractIdentity),
        email: payload.email,
        name: payload.name,
        lastName: payload.lastName,
        identity: Logics.Finances.toNumber(payload.identity),
        areaCode: Logics.Finances.toNumber(payload.areaCode),
        phone: Logics.Finances.toNumber(payload.phone),
        active: true
      })
      try {
        if (userModel) {
          const message = new Utils.Email(
            Utils.Email.VENDOR_REGISTRATION_SUCCESSFULL,
            'iKomida',
            userModel?.name,
            `${this.host}apps`,
            contractModel?.ikomidaID,
            userModel?.phone,
            'iKomida',
            this.host
          )
          const emailPayload = new Types.Classes.CAMQPPayload<Types.Classes.CAMQPPayloadObject>()
          emailPayload.method = 'send'
          const messagePayload: Types.Classes.CEmail = Types.Classes.CEmail.fromObject({
            from: {
              email: `no-replay@ikomida.com`,
              name: `iKomida`
            },
            to: {
              email: userModel?.email,
              name: `${userModel?.name} ${userModel?.lastName}`
            },
            message
          })
          emailPayload.object = messagePayload
          const amqp = new Domain.RabbitMQ(this.logger)
          await amqp?.publish(Domain.RabbitMQ.EMAIL_QUEUE, emailPayload)

          const appMessage: Types.Classes.CApp = Types.Classes.CApp.fromObject({})
          appMessage.displayName = payload.contractName
          appMessage.bundleId = ikomidaID
          const newAppPayload = new Types.Classes.CAMQPPayload<Types.Classes.CAMQPPayloadObject>()
          newAppPayload.method = 'createApp'
          const payloadObject = new Types.Classes.CAMQPPayloadObject()
          payloadObject.message = appMessage
          payloadObject.platform = 'android'
          payloadObject.contractId = contractModel?.id
          newAppPayload.object = payloadObject
          await amqp?.publish<Types.Classes.CAMQPPayloadObject>(Domain.RabbitMQ.APPS_QUEUE, newAppPayload)
          payloadObject.platform = 'ios'
          await amqp?.publish<Types.Classes.CAMQPPayloadObject>(Domain.RabbitMQ.APPS_QUEUE, newAppPayload)
          await amqp?.close()
        }
      } catch (exception: any) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_NEW_CONTRACT_EXCEPTION,
          exception
        )
        error.log(this.logger)
      }
      if (userModel) return new Utils.Return(true, null)
    } catch (exception: any) {
      if (transaction) {
        await transaction?.rollback()
        //TODO: -- cancel payments
      }
      let error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_NEW_CONTRACT_EXCEPTION, exception)
      if (exception instanceof Utils.iKomidaError) {
        error = exception
      }
      return error.logAndReturn(this.logger)
    }
    const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_UNEXPECTED_ERROR)
    return error.logAndReturn(this.logger)
  }

  private async selectPlan(payload: Types.Classes.CContract) {
    const result = await DBModels.PlanModel.findAndCountAll({
      where: {
        name: payload.plan?.name,
        price: Logics.Finances.toFinanceNumber(payload.plan?.price),
        active: true
      }
    })
    return result.count === 1 ? result.rows[0] : null
  }

  //   private createCodeValidationObject(payload: Types.Classes.CContract) {
  //     return Types.Classes.CContract.init('', payload.contractName, payload.name, payload.lastName, payload.contractIdentity, payload.email, payload.phone, payload.areaCode, payload.plan, payload.identity, undefined, payload.termId, payload.password, payload.confirmPassword, payload.address, payload.referredBy, undefined, payload.phoneValidationCode)
  //   }
}
