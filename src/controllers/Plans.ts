import { DBModels, Utils, Logics, Types } from '@ikomida/shared-backend';

export default class Plans {
  logger: Utils.Logger;

  constructor(logger: Utils.Logger) {
    this.logger = logger;
  }

  async getPlans() {
    try {
      const planModels = await DBModels.PlanModel.findAll({
        where: {
          active: true,
        },
        order: [['createdAt', 'ASC']],
      });
      const plans = planModels.map((planModel: DBModels.PlanModel) => {
        const plan = Types.Classes.CPlan.init(
          planModel.name ?? '-',
          planModel.price ?? 0,
          planModel.discount ?? 0,
          planModel.discountType ?? Types.Types.TDiscount.NO,
          planModel.staff ?? -1,
          planModel.products ?? -1,
          planModel.categories ?? -1,
          planModel.pushNotifications ?? -1,
          planModel.orders ?? -1,
          planModel.coupons ?? -1,
          planModel.billing ?? -1,
          planModel.details ?? [],
          planModel.support ?? [],
          planModel.highlighted ?? false,
          (planModel?.price ?? 0) -
            Logics.Finances.calcDiscount(planModel?.price ?? 0, planModel?.discount ?? 0, planModel?.discountType),
          undefined,
          undefined,
          planModel.order,
          planModel.id,
        );
        return plan;
      });
      return new Utils.Return<Types.Classes.CPlan[]>(true, plans);
    } catch (exception: any) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_CONTRACT_SERVICE_GET_PLANS_EXCEPTION, exception);
      return error.logAndReturn(this.logger);
    }
  }
}
