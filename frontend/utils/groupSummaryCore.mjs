export const isGroupHistory = group => group?.membershipStatus !== 'JOINED'
  || ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(group?.status)
  || ['COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED', 'CANCELLED', 'REJECTED'].includes(group?.orderStatus);

export const groupPaymentLabel = status => ({
  VERIFIED: 'Payment verified',
  PARTIAL_REVIEW: 'UPI claim awaiting outlet review',
  AWAITING_VERIFICATION: 'UPI claim awaiting outlet review',
  PARTIAL: 'Some contributions verified',
  PENDING: 'Contributions pending',
  AWAITING_SETUP: 'Payment setup pending',
  NOT_STARTED: 'Payment not started',
}[status] || 'Payment status unavailable');

export const viewerContributionLabel = status => ({
  NOT_REQUIRED: 'Host is covering the group payment', NOT_STARTED: 'Your contribution is not started',
  PENDING: 'Your contribution is pending', CLAIMED: 'Your reference is awaiting outlet review',
  SUCCESS: 'Your contribution is verified',
}[status] || 'Your contribution status is unavailable');

export const groupOrderLabel = status => ({
  PLACED: 'Placed', ACCEPTED: 'Accepted', PREPARING: 'Preparing', READY: 'Ready for pickup',
  PICKED_UP: 'Collected', COMPLETED: 'Collected', DELIVERED: 'Delivered', SERVED: 'Served',
  CANCELLED: 'Cancelled', REJECTED: 'Rejected',
}[status] || 'No order placed');
