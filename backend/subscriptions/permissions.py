from rest_framework.permissions import BasePermission

from accounts.models import User
from api.exceptions import EntitlementRequired

from .services import has_entitlement


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


class HasEntitlement(BasePermission):
    message = "You do not have access to this feature."

    def has_permission(self, request, view):
        # Returning False here would give a plain 403. Raising instead lets
        # the front end tell "not allowed" apart from "not in your plan".
        if not request.user.is_authenticated:
            return False

        if request.user.role != User.Role.CUSTOMER:
            return False

        product_code = getattr(view, "required_product_code", None)

        if not product_code:
            return False

        if not has_entitlement(request.user, product_code):
            raise EntitlementRequired()

        return True