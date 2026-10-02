from rest_framework.permissions import BasePermission

from accounts.models import User
from api.exceptions import EntitlementRequired
from subscriptions.services import has_entitlement


class IsCustomer(BasePermission):
    message = "Only customers can access this endpoint."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == User.Role.CUSTOMER
        )


class IsDietician(BasePermission):
    message = "Only dieticians can access this endpoint."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == User.Role.DIETICIAN
        )


class HasPersonalizedVideoEntitlement(BasePermission):
    message = "You do not have access to personalized videos."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        if request.user.role != User.Role.CUSTOMER:
            return False

        if not has_entitlement(request.user, "PERSONALIZED_VIDEOS"):
            raise EntitlementRequired(
                "Personalized videos are not included in your plan."
            )

        return True